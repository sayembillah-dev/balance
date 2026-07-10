/* Balance — modular dashboard.
   Widgets auto-fit a dense responsive grid, can be added/removed via the
   library, and dragged to reorder. */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wallet, CreditCard, TrendUp, ChartPieSlice, ChartBar, ListBullets, Receipt, Target,
  Gauge, Lightning, Plus, SlidersHorizontal, X, DotsSixVertical, CaretUp, CaretDown,
  ArrowRight, PaperPlaneTilt, HandCoins, ArrowDownLeft, ArrowUpRight, ArrowsLeftRight, Note,
  CalendarBlank,
} from '@phosphor-icons/react';
import LazyQuickAdd from '../components/LazyQuickAdd.jsx';

// ---------- tiny icon helper ----------
const Ico = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const ICONS = {
  wallet: Wallet, card: CreditCard, trend: TrendUp, pie: ChartPieSlice, bars: ChartBar,
  list: ListBullets, bill: Receipt, target: Target, gauge: Gauge, bolt: Lightning,
  plus: Plus, sliders: SlidersHorizontal, x: X, grip: DotsSixVertical, up: CaretUp,
  down: CaretDown, arrow: ArrowRight, send: PaperPlaneTilt, request: HandCoins,
  income: ArrowDownLeft, expense: ArrowUpRight, transfer: ArrowsLeftRight, note: Note,
  calendar: CalendarBlank,
};
const WIcon = ({ k }) => <Ico d={ICONS[k] || ICONS.wallet} />;

const CAT = ['var(--primary)', '#2f6fe0', '#7c4dd8', '#e0892f', '#d6457a', '#3aa3a3'];

const Delta = ({ v, good }) => {
  const up = v >= 0;
  const cls = (good === undefined ? up : good) ? 'up' : 'down';
  return (
    <span className={`chip ${cls}`}>
      <Ico d={up ? ICONS.up : ICONS.down} />{up ? '+' : ''}{v}%
    </span>
  );
};

function Stat({ value, delta, good, sub }) {
  return (
    <div className="wg-body">
      <div className="st-val">{value}</div>
      <div className="st-meta">
        {delta !== undefined && <Delta v={delta} good={good} />}
        <span className="st-sub">{sub}</span>
      </div>
    </div>
  );
}

function Sparkline({ value, delta, pts, label }) {
  const w = 240, h = 38, max = Math.max(...pts), min = Math.min(...pts);
  const sx = (i) => (i / (pts.length - 1)) * w;
  const sy = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const line = pts.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <div className="wg-body">
      <div className="st-val">{value}</div>
      <div className="st-meta">{delta !== undefined && <Delta v={delta} />}<span className="st-sub">{label || 'total invested'}</span></div>
      <div className="st-spark">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polygon points={area} fill="var(--primary-soft)" />
          <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Donut({ segs }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  let acc = 0;
  const stops = segs.map((s, i) => {
    const start = (acc / total) * 360; acc += s.v;
    const end = (acc / total) * 360;
    return `${CAT[i % CAT.length]} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <div className="wg-body">
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="donut-c"><b>{inr(total)}</b><span>spent</span></div>
        </div>
        <div className="legend">
          {segs.map((s, i) => (
            <div className="legend-row" key={s.label}>
              <i style={{ background: CAT[i % CAT.length] }} />
              <span>{s.label}</span><b>{inr(s.v)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, hot }) {
  const max = Math.max(...data.map((d) => d.v)) || 1;
  return (
    <div className="wg-body">
      <div className="bars">
        {data.map((d, i) => (
          <div className="bar-col" key={d.label}>
            <div className={`bar${i === hot ? ' hot' : ''}`} style={{ height: `${(d.v / max) * 100}%` }} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressList({ rows }) {
  return (
    <div className="wg-body">
      <div className="prog-list">
        {rows.map((r) => (
          <div className="prog-row" key={r.label}>
            <div className="prog-top"><span>{r.label}</span><b>{r.spent} / {r.cap}</b></div>
            <div className="track"><i style={{ width: `${r.pct}%`, background: r.pct > 90 ? '#c02626' : 'var(--primary)' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalRing({ pct, title, sub }) {
  return (
    <div className="wg-body">
      <div className="ring-wrap">
        <div className="ring" style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--border-soft) 0)` }}>
          <div className="ring-c"><b>{pct}%</b></div>
        </div>
        <div className="goal-meta"><b>{title}</b><p>{sub}</p></div>
      </div>
    </div>
  );
}

function WList({ rows }) {
  return (
    <div className="wg-body">
      <div className="wlist">
        {rows.map((r, i) => (
          <div className="wlist-row" key={i}>
            <div className="wlist-av" style={{ background: r.tint || 'var(--primary-soft)', color: r.fg || 'var(--primary-ink)' }}>{r.av}</div>
            <div className="wlist-m"><b>{r.name}</b><span>{r.meta}</span></div>
            <div className="wlist-amt">{r.amt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupedBars({ data }) {
  const maxV = Math.max(...data.flatMap((d) => [d.inc, d.exp]), 1);
  return (
    <div className="wg-body">
      <div className="gbars">
        {data.map((d) => (
          <div className="gbar-col" key={d.label}>
            <div className="gbar-pair">
              <div className="gbar inc" style={{ height: `${Math.round((d.inc / maxV) * 100)}%` }} />
              <div className="gbar exp" style={{ height: `${Math.round((d.exp / maxV) * 100)}%` }} />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
      <div className="gbar-legend">
        <span><i style={{ background: '#15803d' }} />Income</span>
        <span><i style={{ background: '#c02626' }} />Expenses</span>
      </div>
    </div>
  );
}

function AccountList({ rows }) {
  if (!rows.length) return <Empty msg="No accounts yet." />;
  return (
    <div className="wg-body">
      <div className="wlist">
        {rows.map((r, i) => (
          <div className="wlist-row" key={i}>
            <div className="wlist-av" style={{ background: `color-mix(in oklab, ${r.color} 15%, #fff 85%)`, color: `color-mix(in oklab, ${r.color} 80%, #000 20%)` }}>{r.av}</div>
            <div className="wlist-m"><b>{r.name}</b><span>{r.type}</span></div>
            <div className="wlist-amt" style={r.neg ? { color: '#c0606a' } : {}}>{r.bal}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllGoals({ goals }) {
  if (!goals.length) return <Empty msg="No goals yet — add some in Saving & Goals." />;
  return (
    <div className="wg-body">
      <div className="prog-list">
        {goals.slice(0, 5).map((g) => (
          <div className="prog-row" key={g.title}>
            <div className="prog-top">
              <span>{g.emoji ? `${g.emoji} ${g.title}` : g.title}</span>
              <b>{g.pct}%</b>
            </div>
            <div className="track"><i style={{ width: `${g.pct}%`, background: g.pct >= 100 ? '#15803d' : 'var(--primary)' }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapCalendar({ days, month, year }) {
  const maxSpend = Math.max(...days.map((d) => d.spend), 1);
  const spendMap = new Map(days.map((d) => [d.date, d.spend]));
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = window.BAL.today();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date, spend: spendMap.get(date) || 0 });
  }
  return (
    <div className="wg-body">
      <div className="hmap-head">
        <b>{MON[month - 1]} {year}</b>
        <div className="hmap-dow">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d}>{d}</span>)}
        </div>
      </div>
      <div className="hmap-grid">
        {cells.map((c, i) => {
          if (!c) return <div key={`p${i}`} className="hmap-cell hmap-pad" />;
          const pct = c.spend > 0 ? Math.max(14, Math.round((c.spend / maxSpend) * 72)) : 0;
          return (
            <div
              key={c.date}
              className={`hmap-cell${c.date === todayStr ? ' hmap-today' : ''}`}
              style={pct > 0 ? { background: `color-mix(in oklab, var(--primary) ${pct}%, var(--surface) ${100 - pct}%)` } : undefined}
              title={c.spend > 0 ? `${c.day} ${MON[month - 1]}: ${inr(c.spend)}` : String(c.day)}
            >
              <span>{c.day}</span>
            </div>
          );
        })}
      </div>
      <div className="hmap-scale">
        <span>Less</span>
        <div className="hmap-dots">
          {[0, 16, 32, 52, 72].map((p) => (
            <i key={p} style={p > 0 ? { background: `color-mix(in oklab, var(--primary) ${p}%, var(--surface) ${100 - p}%)` } : { background: 'var(--border-soft)' }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function Quick() {
  const addTxn = (tab) => window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab } }));
  const goto = (page) => window.dispatchEvent(new CustomEvent('balance:goto', { detail: page }));
  const acts = [
    ['income', 'Income', () => addTxn('income')],
    ['expense', 'Expense', () => addTxn('expense')],
    ['transfer', 'Transfer', () => addTxn('transfer')],
    ['note', 'Note', () => { goto('note'); window.dispatchEvent(new CustomEvent('balance:new-note')); }],
  ];
  return (
    <div className="wg-body">
      <div className="quick">
        {acts.map(([k, l, onClick]) => <button key={l} type="button" onClick={onClick}><WIcon k={k} />{l}</button>)}
      </div>
    </div>
  );
}

// ---------- live data ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// When the "Mask dashboard balances" privacy setting is on, monetary values are
// concealed. Refreshed at the top of computeDashboard() so every figure (incl.
// pre-formatted strings) honours the current setting.
let MASK = false;
const inr = (n) => (MASK ? '••••' : window.BAL.fmt(n));
const ym = (d) => (d || '').slice(0, 7);
const fmtShort = (d) => window.BAL.fmtDate(d, { short: true });

function Empty({ msg }) {
  return <div className="wg-body"><div style={{ opacity: 0.55, fontSize: 14, padding: '10px 2px' }}>{msg}</div></div>;
}

// Derive every widget's data from the live caches (window.BAL). Recomputed when
// data changes, so the dashboard always reflects the real account.
function computeDashboard() {
  MASK = !!window.BAL.loadSettings().privacy;
  const accts = window.BAL.loadAccounts();
  const txns = window.BAL.loadTxns();
  const savings = window.BAL.loadSavings();
  const budgets = window.BAL.loadBudgets();
  const payrecv = window.BAL.loadPayRecv();

  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  let prevMonthIncome = 0, prevMonthExpense = 0;
  const daySpend = {};
  const acctBal = {};
  for (const a of accts) acctBal[a.id] = Number(a.opening) || 0;

  let income = 0, expense = 0, monthIncome = 0, monthExpense = 0;
  const catSpend = {};
  for (const t of txns) {
    if (t.type === 'income') {
      income += t.amount;
      if (ym(t.date) === curYM) monthIncome += t.amount;
      if (ym(t.date) === prevYM) prevMonthIncome += t.amount;
      if (acctBal[t.account] !== undefined) acctBal[t.account] += t.amount;
    } else if (t.type === 'expense') {
      expense += t.amount;
      if (ym(t.date) === curYM) { monthExpense += t.amount; daySpend[t.date] = (daySpend[t.date] || 0) + t.amount; }
      if (ym(t.date) === prevYM) prevMonthExpense += t.amount;
      if (acctBal[t.account] !== undefined) acctBal[t.account] -= t.amount;
      const c = t.category || 'Uncategorized';
      catSpend[c] = (catSpend[c] || 0) + t.amount;
    } else if (t.type === 'transfer') {
      if (acctBal[t.fromAccount] !== undefined) acctBal[t.fromAccount] -= t.amount;
      if (acctBal[t.toAccount] !== undefined) acctBal[t.toAccount] += t.amount;
    }
  }
  const openingSum = accts.reduce((s, a) => s + (Number(a.opening) || 0), 0);
  const balanceTotal = openingSum + income - expense; // transfers net to zero
  const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0;

  const cashflowNet = monthIncome - monthExpense;
  const prevCashflow = prevMonthIncome - prevMonthExpense;
  const cashflowDelta = prevCashflow !== 0 ? Math.round(((cashflowNet - prevCashflow) / Math.abs(prevCashflow)) * 100) : undefined;

  const incomeVsExpense = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let exp = 0, inc = 0;
    for (const t of txns) {
      if (ym(t.date) !== key) continue;
      if (t.type === 'expense') exp += t.amount; else if (t.type === 'income') inc += t.amount;
    }
    incomeVsExpense.push({ label: MON[d.getMonth()], inc: Math.round(inc), exp: Math.round(exp) });
  }

  const accountBalances = accts.map((a) => {
    const bal = acctBal[a.id] || 0;
    return { av: a.name.charAt(0).toUpperCase(), name: a.name, type: a.type, color: a.color || '#138a72', bal: inr(bal), neg: bal < 0 };
  });

  const allGoals = (savings.goals || []).map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    return { emoji: g.emoji, title: g.title, pct };
  });

  const heatmap = {
    month: now.getMonth() + 1, year: now.getFullYear(),
    days: Object.entries(daySpend).map(([date, spend]) => ({ date, spend: Math.round(spend) })),
  };

  const categorySegs = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, v]) => ({ label, v: Math.round(v) }));

  const trend = [], netPts = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let exp = 0, inc = 0;
    for (const t of txns) {
      if (ym(t.date) !== key) continue;
      if (t.type === 'expense') exp += t.amount; else if (t.type === 'income') inc += t.amount;
    }
    trend.push({ label: MON[d.getMonth()], v: Math.round(exp) });
    netPts.push(Math.round(inc - exp));
  }

  const recent = txns.slice(0, 5).map((t) => ({
    av: (t.merchant || '?').charAt(0).toUpperCase(),
    name: t.merchant || '(no description)',
    meta: `${t.category || t.type} · ${fmtShort(t.date)}`,
    amt: (t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '') + inr(t.amount),
  }));

  const goals = savings.goals || [];
  let goal = null;
  if (goals.length) {
    const g = goals.slice().sort((a, b) => (b.saved / (b.target || 1)) - (a.saved / (a.target || 1)))[0];
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    goal = { pct, title: g.title, sub: `${inr(g.saved)} of ${inr(g.target)}` };
  }

  const bills = (payrecv || []).filter((p) => p.kind === 'payable' && !p.settled)
    .sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 4)
    .map((p) => ({ av: (p.party || '?').charAt(0).toUpperCase(), name: p.party, meta: p.due ? `Due ${fmtShort(p.due)}` : 'No due date', amt: inr(p.amount) }));

  const budgetRows = (budgets || []).slice(0, 4).map((b) => {
    // Scope to the budget's own timeframe so this matches the Budgets page.
    const start = window.BAL.budgetPeriodStart(b.timeframe);
    let spent = 0;
    for (const t of txns) {
      if (t.type !== 'expense' || !t.date || String(t.date).slice(0, 10) < start) continue;
      if (b.track === 'category' && t.category === b.category) spent += t.amount;
      else if (b.track === 'tag' && (t.tags || []).includes(b.tagId)) spent += t.amount;
    }
    const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
    return { label: b.name, spent: inr(spent), cap: inr(b.amount), pct };
  });

  return { balanceTotal, monthIncome, monthExpense, savingsRate, categorySegs, trend, netPts, recent, goal, bills, budgetRows, pool: savings.pool || 0, cashflowNet, cashflowDelta, incomeVsExpense, accountBalances, allGoals, heatmap, txns };
}

const CAT_PERIODS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '6m', label: '6 Months' },
  { key: 'year', label: 'This Year' },
];

function catPeriodStart(key) {
  const now = new Date();
  if (key === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (key === 'month') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (key === '6m') {
    const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${now.getFullYear()}-01-01`;
}

function CategoryWidget({ txns }) {
  const [period, setPeriod] = useState('month');
  const start = catPeriodStart(period);
  const catSpend = {};
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    if ((t.date || '').slice(0, 10) < start) continue;
    const c = t.category || 'Uncategorized';
    catSpend[c] = (catSpend[c] || 0) + t.amount;
  }
  const total = Object.values(catSpend).reduce((s, v) => s + v, 0);
  const segs = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, v]) => ({ label, v: Math.round(v) }));
  let acc = 0;
  const stops = segs.map((s, i) => {
    const s0 = (acc / (total || 1)) * 360; acc += s.v;
    return `${CAT[i % CAT.length]} ${s0}deg ${(acc / (total || 1)) * 360}deg`;
  }).join(', ');

  return (
    <div className="wg-body">
      <div className="cat-period-row">
        <select className="cat-period-sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {CAT_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      {segs.length ? (
        <div className="donut-wrap">
          <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
            <div className="donut-c"><b>{inr(total)}</b><span>spent</span></div>
          </div>
          <div className="legend">
            {segs.map((s, i) => (
              <div className="legend-row" key={s.label}>
                <i style={{ background: CAT[i % CAT.length] }} />
                <span>{s.label}</span><b>{inr(s.v)}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ opacity: 0.55, fontSize: 14, padding: '10px 2px' }}>No spending in this period.</div>
      )}
    </div>
  );
}

const CATALOG = {
  balance:      { title: 'Account Balance', icon: 'wallet', w: 1, h: 1, desc: 'Current total balance', render: (d) => <Stat value={inr(d.balanceTotal)} sub="across all accounts" /> },
  expenses:     { title: 'Monthly Expenses', icon: 'card', w: 1, h: 1, desc: 'This month so far', render: (d) => <Stat value={inr(d.monthExpense)} sub="this month" /> },
  savings:      { title: 'Savings Rate', icon: 'gauge', w: 1, h: 1, desc: 'Income kept this month', render: (d) => <Stat value={`${d.savingsRate}%`} sub="of income saved" /> },
  quick:        { title: 'Quick Actions', icon: 'bolt', w: 1, h: 1, desc: 'Shortcuts to move money', render: () => <Quick /> },
  investment:   { title: 'Savings Pool', icon: 'trend', w: 2, h: 1, desc: 'Total saved + recent flow', render: (d) => <Sparkline value={inr(d.pool)} label="total saved" pts={d.netPts.some((x) => x) ? d.netPts : [0, 0, 0, 0, 0, 0, 0, 0]} /> },
  budget:       { title: 'Budget Progress', icon: 'bars', w: 2, h: 1, desc: 'Spending vs caps', render: (d) => d.budgetRows.length ? <ProgressList rows={d.budgetRows} /> : <Empty msg="No budgets yet — add some on the Budgets page." /> },
  goal:         { title: 'Savings Goal', icon: 'target', w: 1, h: 2, desc: 'Progress toward a goal', render: (d) => d.goal ? <GoalRing pct={d.goal.pct} title={d.goal.title} sub={d.goal.sub} /> : <Empty msg="No goals yet — add one in Saving & Goals." /> },
  bills:        { title: 'Upcoming Bills', icon: 'bill', w: 1, h: 2, desc: 'Subscriptions & dues', render: (d) => d.bills.length ? <WList rows={d.bills} /> : <Empty msg="No upcoming dues." /> },
  category:     { title: 'Spending by Category', icon: 'pie', w: 2, h: 2, desc: 'Where your money goes', render: (d) => <CategoryWidget txns={d.txns} /> },
  trend:        { title: 'Monthly Trend', icon: 'bars', w: 2, h: 2, desc: 'Expenses over 8 months', render: (d) => <BarChart hot={7} data={d.trend} /> },
  transactions: { title: 'Recent Transactions', icon: 'list', w: 2, h: 2, desc: 'Latest activity', render: (d) => d.recent.length ? <WList rows={d.recent} /> : <Empty msg="No transactions yet." /> },
  cashflow:     { title: 'Net Cash Flow', icon: 'trend', w: 1, h: 1, desc: 'Monthly surplus or deficit', render: (d) => <Stat value={inr(d.cashflowNet)} delta={d.cashflowDelta} good={d.cashflowNet >= 0} sub={d.cashflowNet >= 0 ? 'surplus this month' : 'deficit this month'} /> },
  incVsExp:     { title: 'Income vs Expenses', icon: 'bars', w: 2, h: 1, desc: '6-month side-by-side view', render: (d) => <GroupedBars data={d.incomeVsExpense} /> },
  accountList:  { title: 'Account Balances', icon: 'wallet', w: 2, h: 1, desc: 'Live balance per account', render: (d) => <AccountList rows={d.accountBalances} /> },
  allGoals:     { title: 'All Savings Goals', icon: 'target', w: 2, h: 1, desc: 'Progress across every goal', render: (d) => <AllGoals goals={d.allGoals} /> },
  heatmap:      { title: 'Spending Calendar', icon: 'calendar', w: 2, h: 2, desc: 'Day-by-day spending this month', render: (d) => <HeatmapCalendar days={d.heatmap.days} month={d.heatmap.month} year={d.heatmap.year} /> },
};

const DEFAULTS = ['balance', 'expenses', 'investment', 'category', 'trend', 'transactions', 'bills', 'goal'];
const STORE = 'balance.widgets.v1';

function WidgetCard({ id, cols, onRemove, onHandleDown, dragging, data }) {
  const c = CATALOG[id];
  if (!c) return null;
  const span = Math.min(c.w, cols);
  return (
    <div
      className={`wg${dragging ? ' dragging' : ''}`}
      style={{ gridColumn: `span ${span}`, gridRow: `span ${c.h}` }}
      data-wid={id}
    >
      <div className="wg-head">
        <div className="wg-title"><span className="wg-ic"><WIcon k={c.icon} /></span><span>{c.title}</span></div>
        <div className="wg-tools">
          <button className="wg-tool grab" title="Drag to reorder" aria-label="Drag to reorder"
                  onPointerDown={(e) => onHandleDown(e, id)}><Ico d={ICONS.grip} /></button>
          <button className="wg-tool" title="Remove" aria-label="Remove widget" onClick={() => onRemove(id)}><Ico d={ICONS.x} /></button>
        </div>
      </div>
      {c.render(data)}
    </div>
  );
}

function Library({ active, onToggle, onClose }) {
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="lib" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lib-head">
          <div>
            <h3>Add widgets</h3>
            <p>{active.length} of {Object.keys(CATALOG).length} added · tap to toggle</p>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><Ico d={ICONS.x} /></button>
        </div>
        <div className="lib-grid">
          {Object.entries(CATALOG).map(([id, c]) => {
            const on = active.includes(id);
            return (
              <div className={`lib-card${on ? ' added' : ''}`} key={id}>
                <span className="li-ic"><WIcon k={c.icon} /></span>
                <div className="li-meta"><h4>{c.title}</h4><p>{c.desc}</p></div>
                <button className="li-btn" onClick={() => onToggle(id)} aria-label={on ? 'Remove' : 'Add'}>
                  <Ico d={on ? ICONS.x : ICONS.plus} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LazyBasicDashboard({ d }) {
  const settings = window.BAL.loadSettings();
  return (
    <div className="lazy-dash">
      <div className="lazy-stats">
        <div className="wg lazy-stat">
          <div className="wg-body">
            <div className="st-sub">Income · this month</div>
            <div className="st-val lazy-inc">{inr(d.monthIncome)}</div>
          </div>
        </div>
        <div className="wg lazy-stat">
          <div className="wg-body">
            <div className="st-sub">Expenses · this month</div>
            <div className="st-val">{inr(d.monthExpense)}</div>
          </div>
        </div>
      </div>
      <LazyQuickAdd defaultAccountId={settings.lazyModeAccountId || null} />
    </div>
  );
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState(() => {
    // A new account is seeded with DEFAULT_WIDGETS server-side, so a stored array
    // (even empty) is the user's real choice — respect it exactly. DEFAULTS is
    // only a fallback if no layout exists at all.
    const s = window.BAL.loadWidgets();
    return Array.isArray(s) && s.length ? s.filter((id) => CATALOG[id]) : (Array.isArray(s) ? [] : DEFAULTS);
  });
  const [cols, setCols] = useState(4);
  const [libOpen, setLibOpen] = useState(false);
  const gridRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  // Widget data, recomputed whenever the underlying data changes (or the page is
  // shown), so the dashboard reflects the real account rather than static demo data.
  const [data, setData] = useState(computeDashboard);
  useEffect(() => {
    const refresh = () => setData(computeDashboard());
    refresh();
    window.addEventListener('balance:txn-changed', refresh);
    window.addEventListener('balance:page', refresh);
    return () => {
      window.removeEventListener('balance:txn-changed', refresh);
      window.removeEventListener('balance:page', refresh);
    };
  }, []);

  useEffect(() => { window.BAL.saveWidgets(widgets); }, [widgets]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      let c = 4;
      if (w < 560) c = 1; else if (w < 840) c = 2; else if (w < 1140) c = 3; else c = 4;
      setCols(c);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const remove = useCallback((id) => setWidgets((w) => w.filter((x) => x !== id)), []);
  const toggle = useCallback((id) => setWidgets((w) => w.includes(id) ? w.filter((x) => x !== id) : [...w, id]), []);

  const startHandle = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setDragId(id);
    document.body.style.userSelect = 'none';
    // Throttle to one reorder check per animation frame: the per-widget
    // getBoundingClientRect() reads force synchronous layout, so running them on
    // every raw pointermove (100+/s) is what makes the drag stutter.
    let frame = null, lastEv = null;
    const processMove = () => {
      frame = null;
      const ev = lastEv;
      const grid = gridRef.current;
      if (!ev || !grid) return;
      let best = null, bestD = Infinity, before = true;
      grid.querySelectorAll('.wg').forEach((el) => {
        const wid = el.dataset.wid;
        if (wid === id) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        if (d < bestD) {
          bestD = d; best = wid;
          before = ev.clientY < cy - 8 ? true : ev.clientY > cy + 8 ? false : ev.clientX < cx;
        }
      });
      if (!best) return;
      const cur = widgetsRef.current;
      const arr = cur.filter((x) => x !== id);
      let idx = arr.indexOf(best);
      if (!before) idx += 1;
      arr.splice(idx, 0, id);
      if (arr.join() !== cur.join()) setWidgets(arr);
    };
    const move = (ev) => {
      lastEv = ev;
      if (frame == null) frame = requestAnimationFrame(processMove);
    };
    const up = () => {
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      setDragId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const lazy = !!window.BAL.loadSettings().lazyMode;

  if (lazy) {
    return (
      <div className="dash">
        <div className="dash-head">
          <div><h2>Overview</h2><p>Lazy mode is on — quick add from the buttons below.</p></div>
        </div>
        <LazyBasicDashboard d={data} />
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h2>Overview</h2>
          <p>{widgets.length} widget{widgets.length === 1 ? '' : 's'} · drag to rearrange</p>
        </div>
        <div className="dash-actions">
          <button className="btn-primary" onClick={() => setLibOpen(true)}><Ico d={ICONS.sliders} />Manage Widgets</button>
        </div>
      </div>

      <div className="dash-grid" ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {widgets.map((id) => (
          <WidgetCard key={id} id={id} cols={cols} onRemove={remove} onHandleDown={startHandle} dragging={dragId === id} data={data} />
        ))}
      </div>

      {widgets.length === 0 && (
        <div className="dash-empty">
          <span className="badge"><Ico d={ICONS.bars} /></span>
          <h3>Your dashboard is empty</h3>
          <p>Add widgets to track balances, spending, goals and more — they’ll arrange themselves to fit.</p>
          <button className="btn-primary" onClick={() => setLibOpen(true)}><Ico d={ICONS.plus} />Add your first widget</button>
        </div>
      )}

      {libOpen && <Library active={widgets} onToggle={toggle} onClose={() => setLibOpen(false)} />}
    </div>
  );
}
