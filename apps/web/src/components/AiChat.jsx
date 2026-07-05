/* Balance — Ask Balance: quick inquiry chips (no AI required). */
import React, { useState, useEffect } from 'react';
import {
  Sparkle, X, Wallet, ArrowDown, Tag,
  Warning, ArrowsLeftRight, PiggyBank, ArrowLeft, ArrowRight,
} from '@phosphor-icons/react';

const QUESTIONS = [
  { id: 'balance', icon: Wallet,          label: "What's my total balance?"              },
  { id: 'spent',   icon: ArrowDown,       label: "How much did I spend this month?"      },
  { id: 'top_cat', icon: Tag,             label: "Top expense category this month"       },
  { id: 'budgets', icon: Warning,         label: "Am I over budget anywhere?"            },
  { id: 'payrecv', icon: ArrowsLeftRight, label: "What's outstanding in Pay & Receive?"  },
  { id: 'goals',   icon: PiggyBank,       label: "How are my savings goals?"             },
];

function computeAnswer(id) {
  const BAL = window.BAL;
  if (!BAL) return { error: 'Data not loaded yet. Try again in a moment.' };

  const fmt        = BAL.fmt;
  const today      = BAL.today();
  const [y, m]     = today.split('-').map(Number);
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const accounts   = BAL.loadAccounts();
  const txns       = BAL.loadTxns();

  if (id === 'balance') {
    if (!accounts.length) return { empty: 'No accounts set up yet.' };
    // Opening balance + all transaction movements per account
    const bal = {};
    for (const a of accounts) bal[a.id] = Number(a.opening) || 0;
    for (const t of txns) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'expense' && t.account)     bal[t.account] = (bal[t.account] || 0) - amt;
      else if (t.type === 'income' && t.account) bal[t.account] = (bal[t.account] || 0) + amt;
      else if (t.type === 'transfer') {
        if (t.fromAccount) bal[t.fromAccount] = (bal[t.fromAccount] || 0) - amt;
        if (t.toAccount)   bal[t.toAccount]   = (bal[t.toAccount]   || 0) + amt;
      }
    }
    const total = Object.values(bal).reduce((s, v) => s + v, 0);
    return {
      summary:      fmt(total),
      summaryLabel: 'Total across all accounts',
      rows:         accounts.map(a => ({ label: a.name, value: fmt(bal[a.id] || 0) })),
      action:       { label: 'View Accounts', page: 'accounts' },
    };
  }

  if (id === 'spent') {
    const expenses = txns.filter(t => t.type === 'expense' && t.date >= monthStart);
    const income   = txns.filter(t => t.type === 'income'  && t.date >= monthStart);
    const spent    = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const earned   = income.reduce((s,  t) => s + (Number(t.amount) || 0), 0);
    return {
      summary:      fmt(spent),
      summaryLabel: 'Spent this month',
      rows: [
        { label: 'Income',   value: fmt(earned) },
        { label: 'Expenses', value: fmt(spent)  },
        { label: 'Net', value: fmt(earned - spent), highlight: earned >= spent, warn: earned < spent },
      ],
      action: { label: 'View Transactions', page: 'transactions' },
    };
  }

  if (id === 'top_cat') {
    const expenses = txns.filter(t => t.type === 'expense' && t.date >= monthStart);
    if (!expenses.length) return { empty: 'No expenses recorded this month.' };
    const byCat = {};
    for (const t of expenses) {
      const cat = t.category || 'Uncategorized';
      byCat[cat] = (byCat[cat] || 0) + (Number(t.amount) || 0);
    }
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const total  = sorted.reduce((s, [, v]) => s + v, 0);
    return {
      summary:      sorted[0][0],
      summaryLabel: `${fmt(sorted[0][1])} — top category this month`,
      rows: sorted.slice(0, 5).map(([cat, amt]) => ({
        label: cat,
        value: fmt(amt),
        sub:   total ? `${Math.round((amt / total) * 100)}%` : '',
      })),
      action: { label: 'View Transactions', page: 'transactions' },
    };
  }

  if (id === 'budgets') {
    const budgets = BAL.loadBudgets();
    if (!budgets.length) return { empty: 'No budgets set up yet.' };
    const results = budgets.map(b => {
      const periodStart = b.periodStart || BAL.budgetPeriodStart(b.timeframe);
      let spent = 0;
      if (b.track === 'category') {
        spent = txns
          .filter(t => t.type === 'expense' && t.date >= periodStart && t.category === b.category)
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      } else if (b.track === 'tag') {
        spent = txns
          .filter(t => t.date >= periodStart && (t.tags || []).includes(b.tagId))
          .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      }
      const cap = Number(b.amount) || 0;
      const pct = cap > 0 ? spent / cap : 0;
      return { name: b.name, spent, cap, pct, over: pct >= 1, close: pct >= 0.8 && pct < 1 };
    });
    const over  = results.filter(r => r.over);
    const close = results.filter(r => r.close);
    return {
      summary:      over.length  ? `${over.length} over budget`  : close.length ? `${close.length} near limit` : 'All on track',
      summaryLabel: over.length  ? 'Budget exceeded'             : close.length ? 'Getting close to the cap'   : 'Within all budgets',
      warn: over.length > 0,
      rows: results.map(r => ({
        label:     r.name,
        value:     `${fmt(r.spent)} / ${fmt(r.cap)}`,
        sub:       `${Math.round(r.pct * 100)}%`,
        warn:      r.over,
        highlight: !r.over && !r.close,
      })),
      action: { label: 'View Budgets', page: 'budget' },
    };
  }

  if (id === 'payrecv') {
    const pr        = BAL.loadPayRecv().filter(p => !p.settled);
    if (!pr.length) return { empty: 'Nothing outstanding in Pay & Receive.' };
    const toReceive = pr.filter(p => p.kind === 'receive');
    const toPay     = pr.filter(p => p.kind === 'pay');
    const totalIn   = toReceive.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalOut  = toPay.reduce((s,    p) => s + (Number(p.amount) || 0), 0);
    const rows = [];
    if (toReceive.length) rows.push({ label: `Owed to you (${toReceive.length})`, value: fmt(totalIn),  highlight: true });
    if (toPay.length)     rows.push({ label: `You owe (${toPay.length})`,         value: fmt(totalOut), warn: true });
    for (const p of toReceive.slice(0, 3))
      rows.push({ label: p.party, value: fmt(p.amount), sub: p.due ? `Due ${BAL.fmtDate(p.due, { withYear: false })}` : '', indent: true });
    for (const p of toPay.slice(0, 3))
      rows.push({ label: p.party, value: fmt(p.amount), sub: p.due ? `Due ${BAL.fmtDate(p.due, { withYear: false })}` : '', indent: true, warn: true });
    return {
      summary:      fmt(totalIn - totalOut),
      summaryLabel: 'Net outstanding',
      rows,
      action: { label: 'View Pay & Receive', page: 'pay' },
    };
  }

  if (id === 'goals') {
    const { pool, goals } = BAL.loadSavings();
    if (!goals.length) return { empty: 'No savings goals yet. Head to Saving & Goals to create one.' };
    return {
      summary:      fmt(pool || 0),
      summaryLabel: 'Available in savings pool',
      rows: goals.map(g => {
        const saved  = Number(g.saved)  || 0;
        const target = Number(g.target) || 0;
        const pct    = target > 0 ? Math.min(1, saved / target) : 0;
        return {
          label:     [g.emoji, g.title].filter(Boolean).join(' '),
          value:     `${fmt(saved)} / ${fmt(target)}`,
          sub:       `${Math.round(pct * 100)}%${g.deadline ? ` · due ${BAL.fmtDate(g.deadline, { withYear: false })}` : ''}`,
          highlight: pct >= 1,
        };
      }),
      action: { label: 'View Savings', page: 'savings' },
    };
  }

  return { error: 'Unknown question.' };
}

function HomeScreen({ onSelect }) {
  return (
    <>
      <p className="ai-intro">Select a question for an instant answer from your data.</p>
      <div className="ai-chips">
        {QUESTIONS.map(q => (
          <button key={q.id} className="ai-chip" onClick={() => onSelect(q)}>
            <q.icon weight="fill" />
            {q.label}
          </button>
        ))}
      </div>
    </>
  );
}

function AnswerScreen({ question, onBack, onClose }) {
  const r = computeAnswer(question.id);

  function goTo(page) {
    window.dispatchEvent(new CustomEvent('balance:goto', { detail: page }));
    onClose();
  }

  return (
    <div className="ai-answer">
      <button className="ai-back" onClick={onBack}>
        <ArrowLeft weight="bold" /> Back
      </button>
      <p className="ai-ans-q">{question.label}</p>

      {r.error && <p className="ai-ans-err">{r.error}</p>}

      {r.empty && (
        <>
          <p className="ai-ans-empty">{r.empty}</p>
          {r.action && (
            <div className="ai-act-row">
              <button className="ai-act" onClick={() => goTo(r.action.page)}>
                {r.action.label} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {!r.error && !r.empty && (
        <>
          <div className={`ai-ans-sum${r.warn ? ' warn' : ''}`}>
            <span className="ai-ans-val">{r.summary}</span>
            <span className="ai-ans-lbl">{r.summaryLabel}</span>
          </div>

          {r.rows?.length > 0 && (
            <div className="ai-ans-rows">
              {r.rows.map((row, i) => (
                <div
                  key={i}
                  className={[
                    'ai-ans-row',
                    row.warn      ? 'warn'   : '',
                    row.highlight ? 'good'   : '',
                    row.indent    ? 'indent' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className="ai-ans-rl">{row.label}</span>
                  <div className="ai-ans-rr">
                    <span className="ai-ans-rv">{row.value}</span>
                    {row.sub && <span className="ai-ans-rs">{row.sub}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {r.action && (
            <div className="ai-act-row">
              <button className="ai-act" onClick={() => goTo(r.action.page)}>
                {r.action.label} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chat({ onClose }) {
  const [activeQ, setActiveQ] = useState(null);

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="ai-scrim" onClick={onClose} />
      <div className="ai-drawer" role="dialog" aria-label="Balance assistant">
        <div className="ai-head">
          <span className="mk"><Sparkle weight="fill" /></span>
          <div className="ht">
            <b>Ask Balance <span className="pill">AI</span></b>
            <span>Quick answers from your data</span>
          </div>
          <button className="ai-x" onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="ai-body">
          {activeQ
            ? <AnswerScreen question={activeQ} onBack={() => setActiveQ(null)} onClose={onClose} />
            : <HomeScreen onSelect={setActiveQ} />
          }
        </div>

        <div className="ai-dock">
          <div className="ai-inputwrap ai-inputwrap-cs">
            <textarea placeholder="Ask anything... (AI coming soon)" disabled rows={1} />
            <button className="ai-send" disabled aria-label="Send"><ArrowRight /></button>
          </div>
          <p className="ai-hint">Full AI responses coming in a future update</p>
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
