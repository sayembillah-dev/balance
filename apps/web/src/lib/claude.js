/* A graceful fallback for window.claude.complete used by the AI chat.
   In the design tool, `window.claude.complete` is provided by the host. In this
   standalone app it isn't, so we install a lightweight local responder that
   answers a few common questions from the grounding DATA embedded in the prompt
   and otherwise nudges the user. If you wire a real model, just provide your own
   window.claude.complete before this module loads and it will be respected. */

function localComplete(prompt) {
  const dataMatch = prompt.match(/DATA:\n([\s\S]*?)\n\nConversation:/);
  const data = dataMatch ? dataMatch[1] : '';
  const lastUser = (prompt.match(/User: ([^\n]*)\nAssistant:\s*$/) || [])[1] || '';
  const q = lastUser.toLowerCase();

  const line = (label) => {
    const m = data.split('\n').find((l) => l.toLowerCase().includes(label));
    return m ? m.trim() : '';
  };

  if (/summary|spend|spent|overview/.test(q)) {
    const totals = line('total income');
    const cats = line('spending by category');
    return `Here's a quick snapshot:\n${totals}\n${cats}\n\nWant to dig into a category? [ACTION:budget]`;
  }
  if (/goal|track/.test(q)) {
    const goals = line('goals:');
    return goals
      ? `Your goals:\n${goals.replace(/^Goals:\s*/i, '')}\n\nYou can move money into a goal from Saving & Goals. [ACTION:allocate]`
      : "You don't have any goals set up yet. Head to Saving & Goals to create one. [ACTION:allocate]";
  }
  if (/budget/.test(q)) {
    const b = line('budgets:');
    return (b ? `Your budgets:\n${b.replace(/^Budgets:\s*/i, '')}` : "No budgets configured yet.") + '\n\n[ACTION:budget]';
  }
  if (/subscription|recurring|cut back|save/.test(q)) {
    return 'Look at your Bills category and tags like #Subscription to spot recurring spend you can trim. [ACTION:budget]';
  }
  if (/add|record|new transaction|spent ₹|paid/.test(q)) {
    return 'Sure — I can open the new-transaction form for you. [ACTION:add]';
  }
  return `I'm the built-in demo assistant, grounded in your data:\n\n${data}\n\nConnect a real model via window.claude.complete for richer answers.`;
}

if (typeof window !== 'undefined' && !window.claude) {
  window.claude = {
    complete: async (prompt) => {
      await new Promise((r) => setTimeout(r, 550));
      return localComplete(prompt);
    },
  };
}
