/* Balance — AI assistant.
   Opens on `balance:ai-open`. A right-side chat drawer that answers questions
   grounded in the user's real data (window.BAL) via window.claude.complete,
   and can suggest actions that trigger existing app flows. */
import React, { useState, useEffect, useRef } from 'react';
import { Sparkle, X, PaperPlaneTilt, ChartLineUp, MagnifyingGlass, Target, Bell, Plus, ArrowRight, GearSix } from '@phosphor-icons/react';
import { apiPost, apiGet } from '../lib/api.js';

const A = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const AI = {
  spark: Sparkle, x: X, send: PaperPlaneTilt, chart: ChartLineUp, search: MagnifyingGlass,
  target: Target, bell: Bell, plus: Plus, arrow: ArrowRight, gear: GearSix,
};

const inr = (n) => window.BAL.fmt(n);

function buildContext() {
  const accts = window.BAL.loadAccounts();
  const txns = window.BAL.loadTxns();
  const bal = (a) => {
    let inc = 0, sp = 0, xi = 0, xo = 0;
    for (const t of txns) {
      if (t.type === 'transfer') { if (t.fromAccount === a.id) xo += t.amount; else if (t.toAccount === a.id) xi += t.amount; continue; }
      if (t.account === a.id) { if (t.type === 'income') inc += t.amount; else sp += t.amount; }
    }
    return a.opening + inc - sp + xi - xo;
  };
  let income = 0, expense = 0; const catSpend = {}; const tagSpend = {};
  for (const t of txns) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') {
      expense += t.amount;
      catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
      (t.tags || []).forEach((tg) => { tagSpend[tg] = (tagSpend[tg] || 0) + t.amount; });
    }
  }
  const tagName = (id) => { const t = window.BAL.tag(id); return t ? t.name : id; };
  const cats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${inr(v)}`);
  const tagsTop = Object.entries(tagSpend).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `#${tagName(k)} ${inr(v)}`);
  let extra = '';
  try { const b = window.BAL.loadBudgets(); if (Array.isArray(b) && b.length) extra += '\nBudgets: ' + b.map((x) => `${x.name} cap ${inr(x.amount)} (${x.track === 'tag' ? '#tag' : x.category})`).join('; '); } catch (e) {}
  try { const s = window.BAL.loadSavings(); if (s && s.goals && s.goals.length) extra += '\nGoals: ' + s.goals.map((g) => `${g.title} ${inr(g.saved)}/${inr(g.target)} by ${g.deadline}`).join('; '); } catch (e) {}
  return [
    'Accounts (current balance):',
    ...accts.map((a) => `- ${a.name} (${a.type}): ${inr(bal(a))}`),
    `Net worth: ${inr(accts.reduce((s, a) => s + bal(a), 0))}`,
    `Total income (recorded): ${inr(income)} | Total spent: ${inr(expense)} | ${txns.length} transactions`,
    'Spending by category: ' + cats.join(', '),
    tagsTop.length ? 'Spending by tag: ' + tagsTop.join(', ') : '',
    extra,
  ].filter(Boolean).join('\n');
}

const SUGGESTIONS = [
  { icon: AI.chart, text: 'Give me a spending summary' },
  { icon: AI.target, text: 'Am I on track for my goals?' },
  { icon: AI.search, text: 'Where can I cut back?' },
  { icon: AI.bell, text: 'What subscriptions am I paying for?' },
];

const ACTIONS = {
  add:      { label: 'Add a transaction', icon: AI.plus, run: () => window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab: 'expense' } })) },
  allocate: { label: 'Open Saving & Goals', icon: AI.target, nav: 'savings' },
  budget:   { label: 'Open Budgets', icon: AI.chart, nav: 'budget' },
  pay:      { label: 'Open Pay & Receive', icon: AI.arrow, nav: 'pay' },
};

function parseActions(text) {
  const found = [];
  const clean = text.replace(/\[ACTION:(\w+)\]/gi, (m, k) => { const key = k.toLowerCase(); if (ACTIONS[key] && !found.includes(key)) found.push(key); return ''; }).trim();
  return { clean, actions: found };
}

function Chat({ onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // null = checking, true = ready, false = not configured
  const [aiReady, setAiReady] = useState(null);
  const bodyRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    apiGet('/me/ai-settings')
      .then((d) => setAiReady(!!(d.enabled && d.activeModelId)))
      .catch(() => setAiReady(false));
  }, []);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => { const onKey = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);

  const send = async (text) => {
    const q = (text || '').trim();
    if (!q || busy) return;
    const history = [...msgs, { role: 'user', text: q }];
    setMsgs(history); setInput(''); setBusy(true);
    if (taRef.current) taRef.current.style.height = 'auto';
    const convo = history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
    const prompt = `You are "Balance Assistant", a warm, concise personal-finance helper inside the Balance app. Today is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Answer ONLY from the DATA below — never invent numbers. Use the ${window.BAL.sym()} symbol for money. Keep replies short: 1–4 sentences or a tight bullet list. If the user clearly wants to record a transaction, move money to a goal, check a budget, or settle a due, suggest it by adding a tag on its OWN final line: [ACTION:add], [ACTION:allocate], [ACTION:budget], or [ACTION:pay]. Only add an action tag when it genuinely helps.\n\nDATA:\n${buildContext()}\n\nConversation:\n${convo}\nAssistant:`;
    try {
      const res = await apiPost('/me/ai-chat', { prompt });
      if (res.error) throw new Error(res.error);
      const { clean, actions } = parseActions(res.text || 'Sorry, I could not work that out.');
      setMsgs((m) => [...m, { role: 'ai', text: clean || 'Done.', actions }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: e?.message || 'Sorry — something went wrong. Please try again.', isErr: true }]);
    }
    setBusy(false);
  };

  const runAction = (key) => {
    const a = ACTIONS[key]; if (!a) return;
    onClose();
    if (a.run) a.run();
    else if (a.nav) { const el = document.querySelector(`.nav-item[data-key="${a.nav}"]`); if (el) el.click(); }
  };

  const onInput = (e) => { setInput(e.target.value); const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  return (
    <>
      <div className="ai-scrim" onClick={onClose} />
      <div className="ai-drawer" role="dialog" aria-label="Balance assistant">
        <div className="ai-head">
          <span className="mk"><A d={AI.spark} fill /></span>
          <div className="ht"><b>Ask Balance <span className="pill">AI</span></b><span>Your money, answered</span></div>
          <button className="ai-x" onClick={onClose} aria-label="Close"><A d={AI.x} /></button>
        </div>

        <div className="ai-body" ref={bodyRef}>
          {msgs.length === 0 && (
            <div className="ai-empty">
              <span className="orb"><A d={AI.spark} fill /></span>
              {aiReady === false ? (
                <>
                  <h4>AI not configured</h4>
                  <p>Add an AI model in Settings to start chatting.</p>
                  <button className="ai-chip" onClick={() => {
                    onClose();
                    // Navigate to AI settings tab
                    setTimeout(() => {
                      const el = document.querySelector('.nav-item[data-key="settings"]');
                      if (el) el.click();
                    }, 100);
                  }}><A d={AI.gear} />Open AI Settings</button>
                </>
              ) : (
                <>
                  <h4>Hi there 👋</h4>
                  <p>Ask me anything about your spending, budgets, accounts or goals.</p>
                  <div className="ai-chips">
                    {SUGGESTIONS.map((s) => (
                      <button className="ai-chip" key={s.text} onClick={() => send(s.text)}><A d={s.icon} />{s.text}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {msgs.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              {m.role === 'ai' && <div className="who"><span className="d" />Balance Assistant</div>}
              <div className={`bub${m.isErr ? ' bub-err' : ''}`}>{m.text}</div>
              {m.actions && m.actions.length > 0 && (
                <div className="ai-act-row">
                  {m.actions.map((k) => <button className="ai-act" key={k} onClick={() => runAction(k)}><A d={ACTIONS[k].icon} />{ACTIONS[k].label}</button>)}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="msg ai">
              <div className="who"><span className="d" />Balance Assistant</div>
              <div className="ai-think"><i /><i /><i /></div>
            </div>
          )}
        </div>

        <div className="ai-dock">
          <div className="ai-inputwrap">
            <textarea ref={taRef} rows={1} value={input} placeholder="Message Balance…" onChange={onInput} onKeyDown={onKeyDown} />
            <button className="ai-send" onClick={() => send(input)} disabled={!input.trim() || busy} aria-label="Send"><A d={AI.send} /></button>
          </div>
          <div className="ai-hint">Balance can answer questions and help you take action.</div>
        </div>
      </div>
    </>
  );
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('balance:ai-open', h);
    return () => window.removeEventListener('balance:ai-open', h);
  }, []);
  if (!open) return null;
  return <Chat onClose={() => setOpen(false)} />;
}
