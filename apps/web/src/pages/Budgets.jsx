/* Balance — Budgets.
   Budgets track either a Category or a Tag. Tag budgets choose Parallel
   (count toward category too) or Isolated tracking. */
import React, { useState, useEffect, useRef } from 'react';
import Select from '../components/Select.jsx';
import AmountInput from '../components/AmountInput.jsx';
import { Plus, X, PencilSimple, Trash, SquaresFour, Tag, Wallet, ArrowsClockwise, ClockCounterClockwise } from '@phosphor-icons/react';
import ThreeDots from '../components/ThreeDots.jsx';

const B = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const BI = {
  plus: Plus, x: X, kebab: ThreeDots, edit: PencilSimple, trash: Trash,
  grid: SquaresFour, tag: Tag, wallet: Wallet, recur: ArrowsClockwise, history: ClockCounterClockwise,
};
const Switch = ({ on, onClick }) => <button type="button" className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={!!on} onClick={onClick}><i /></button>;
// "Weekly" → "week", etc. — for the recurring toggle's plain-language label.
const periodNoun = (tf) => ({ Weekly: 'week', Monthly: 'month', Yearly: 'year' }[tf] || 'period');
const STORE = 'balance.budgets.v1';
const money = (n) => window.BAL.fmt(n);
const TIMEFRAMES = ['Monthly', 'Weekly', 'Yearly'];
const catColor = (n) => window.BAL.catColor(n);

const SEED = [
  { id: 'b1', name: 'Groceries & Food', amount: 12000, timeframe: 'Monthly', track: 'category', category: 'Food' },
  { id: 'b2', name: 'Shopping cap',      amount: 8000,  timeframe: 'Monthly', track: 'category', category: 'Shopping' },
  { id: 'b3', name: "Wife's Allowance",  amount: 15000, timeframe: 'Monthly', track: 'tag', tagId: 't_personal', mode: 'parallel' },
  { id: 'b4', name: 'Work (reimbursed)', amount: 10000, timeframe: 'Monthly', track: 'tag', tagId: 't_reimb', mode: 'isolated' },
];
const load = () => window.BAL.loadBudgets();

const spentFor = (b, txns) => {
  const start = window.BAL.budgetPeriodStart(b.timeframe);
  return txns.reduce((s, t) => {
    if (t.type !== 'expense') return s;
    // Only count transactions in the current period. Date-only strings sort
    // lexicographically, so a plain string compare is a valid date compare.
    if (!t.date || String(t.date).slice(0, 10) < start) return s;
    if (b.track === 'category') return t.category === b.category ? s + t.amount : s;
    return (t.tags || []).includes(b.tagId) ? s + t.amount : s;
  }, 0);
};

const tagName = (tags, id) => { const t = tags.find((x) => x.id === id); return t ? t.name : 'tag'; };

function BudgetModal({ initial, tags, cats, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.amount && (f.track === 'category' ? f.category : f.tagId);
  const [saving, setSaving] = useState(false);
  const save = () => { if (!valid) return; setSaving(true); onSave({ ...f, name: f.name.trim(), amount: Math.abs(Number(f.amount)) }); };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(500px,100%)' }}>
        <div className="modal-head">
          <h3>{initial.id ? 'Edit budget rule' : 'Create budget rule'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><B d={BI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Budget name</label>
            <input autoFocus value={f.name} placeholder="e.g. Wife's Monthly Allowance" onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Amount</label>
              <AmountInput cur={window.BAL.sym()} value={f.amount} placeholder="5,000" onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Timeframe</label>
              <Select value={f.timeframe} onChange={(v) => set('timeframe', v)} ariaLabel="Timeframe"
                options={TIMEFRAMES.map((t) => ({ value: t, label: t }))} />
            </div>
          </div>

          <div className="recur-row">
            <div className="recur-txt">
              <b><B d={BI.recur} />Recurring budget</b>
              <p>Auto-renew every {periodNoun(f.timeframe)} — each finished {periodNoun(f.timeframe)} is archived to history (cap vs. spent).</p>
            </div>
            <Switch on={f.recurring} onClick={() => set('recurring', !f.recurring)} />
          </div>

          <div className="field">
            <label>What are you tracking?</label>
            <div className="track-seg">
              <button className={f.track === 'category' ? 'on' : ''} onClick={() => set('track', 'category')}><B d={BI.grid} />By Category</button>
              <button className={f.track === 'tag' ? 'on' : ''} onClick={() => set('track', 'tag')}><B d={BI.tag} />By Tag</button>
            </div>
          </div>

          {f.track === 'category' ? (
            <div className="field">
              <label>Category</label>
              <Select value={f.category || ''} onChange={(v) => set('category', v)} placeholder="Choose a category…" ariaLabel="Category"
                options={cats.map((c) => ({ value: c, label: c }))} />
            </div>
          ) : (
            <>
              <div className="field">
                <label>Tag</label>
                <div className="tag-pick single">
                  {tags.map((tg) => {
                    const on = f.tagId === tg.id;
                    return (
                      <button type="button" key={tg.id} className="tag-opt"
                        style={on ? { background: `color-mix(in oklab, ${tg.color} 15%, #fff 85%)`, color: `color-mix(in oklab, ${tg.color} 78%, #000 22%)`, borderColor: 'transparent' } : null}
                        onClick={() => set('tagId', tg.id)}><i style={{ background: tg.color }} />{tg.name}</button>
                    );
                  })}
                </div>
              </div>
              <div className="field">
                <label>How should this affect other budgets?</label>
                <div className="radio-cards">
                  <div className={`radio-card${f.mode === 'parallel' ? ' on' : ''}`} onClick={() => set('mode', 'parallel')}>
                    <span className="radio-dot" />
                    <div className="rc-txt">
                      <b>Parallel tracking <span className="rec">Recommended</span></b>
                      <p>Transactions count toward this tag budget AND their standard category at the same time (e.g. eating out with #{tagName(tags, f.tagId)} affects both Food and this budget).</p>
                    </div>
                  </div>
                  <div className={`radio-card${f.mode === 'isolated' ? ' on' : ''}`} onClick={() => set('mode', 'isolated')}>
                    <span className="radio-dot" />
                    <div className="rc-txt">
                      <b>Isolate tag expenses</b>
                      <p>Any transaction with this tag bypasses your regular category budgets entirely and only counts here.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!valid || saving}>{saving ? <><span className="btn-spin" />Saving…</> : 'Save budget rule'}</button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ onEdit, onDel, onHistory, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; window.addEventListener('mousedown', h); return () => window.removeEventListener('mousedown', h); }, [onClose]);
  return (
    <div className="menu" ref={ref} style={{ top: 38 }}>
      <button onClick={onEdit}><B d={BI.edit} />Edit</button>
      {onHistory && <button onClick={onHistory}><B d={BI.history} />View history</button>}
      <div className="sep" />
      <button className="danger" onClick={onDel}><B d={BI.trash} />Delete</button>
    </div>
  );
}

// Read-only list of a recurring budget's archived periods, fetched on open.
function HistoryModal({ budget, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    window.BAL.budgetPeriods(budget.id)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [budget.id]);
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(460px,100%)' }}>
        <div className="modal-head">
          <h3><B d={BI.history} /> {budget.name} — history</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><B d={BI.x} /></button>
        </div>
        <div className="modal-body">
          {err ? (
            <div className="pr-empty"><b>Couldn't load history</b><span>Please try again.</span></div>
          ) : rows == null ? (
            <div className="pr-empty"><span>Loading…</span></div>
          ) : rows.length === 0 ? (
            <div className="pr-empty"><b>No archived periods yet</b><span>The first period is archived once it ends.</span></div>
          ) : (
            <div className="hist-list">
              {rows.map((p) => {
                const over = p.spent > p.cap;
                const pct = p.cap ? Math.min(100, Math.round((p.spent / p.cap) * 100)) : 0;
                return (
                  <div className={`hist-row${over ? ' over' : ''}`} key={p.id}>
                    <div className="hist-when">{window.BAL.fmtDate(p.periodStart, { short: true })} – {window.BAL.fmtDate(p.periodEnd, { short: true })}</div>
                    <div className="track"><i style={{ width: `${pct}%`, background: over ? '#c02626' : 'var(--primary)' }} /></div>
                    <div className="hist-figs">
                      <span className="spent">{window.BAL.fmt(p.spent)} <small>/ {window.BAL.fmt(p.cap)}</small></span>
                      <span className={over ? 'out' : 'in'}>{over ? `${window.BAL.fmt(p.spent - p.cap)} over` : `${window.BAL.fmt(p.cap - p.spent)} left`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default function Budgets() {
  const [budgets, setBudgets] = useState(load());
  const [txns, setTxns] = useState(window.BAL.loadTxns());
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [history, setHistory] = useState(null);
  const tags = window.BAL.loadTags();
  const cats = window.BAL.loadCategories().filter((c) => c.type === 'expense').map((c) => c.name);

  useEffect(() => { window.BAL.saveBudgets(budgets); }, [budgets]);
  useEffect(() => {
    const h = () => setTxns(window.BAL.loadTxns());
    window.addEventListener('balance:txn-changed', h);
    window.addEventListener('balance:page', h);
    return () => { window.removeEventListener('balance:txn-changed', h); window.removeEventListener('balance:page', h); };
  }, []);

  const save = (b) => { setBudgets((all) => b.id ? all.map((x) => x.id === b.id ? b : x) : [...all, { ...b, id: window.BAL.newId() }]); setEditing(null); };
  const del = (id) => { setBudgets((all) => all.filter((x) => x.id !== id)); setMenu(null); };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + spentFor(b, txns), 0);

  const tagOf = (id) => tags.find((t) => t.id === id);
  const blank = { name: '', amount: '', timeframe: 'Monthly', track: 'category', category: '', tagId: '', mode: 'parallel', recurring: false };

  return (
    <div className="budgets">
      <div className="txn-head">
        <div><h2>Budgets</h2><p>Cap spending by category or by tag — {money(totalSpent)} of {money(totalBudget)} used</p></div>
        <button className="btn-primary" onClick={() => setEditing(blank)}><B d={BI.plus} />New budget</button>
      </div>

      <div className="acct-sum">
        <div className="tile"><div className="tlab"><span className="tic"><B d={BI.wallet} /></span>Total budgeted</div><b>{money(totalBudget)}</b></div>
        <div className="tile"><div className="tlab"><span className="tic"><B d={BI.grid} /></span>Spent</div><b className={totalSpent > totalBudget ? 'out' : ''}>{money(totalSpent)}</b></div>
        <div className="tile"><div className="tlab"><span className="tic"><B d={BI.tag} /></span>Remaining</div><b className={totalBudget - totalSpent < 0 ? 'out' : 'in'}>{money(Math.max(0, totalBudget - totalSpent))}</b></div>
      </div>

      <div className="bud-grid">
        {budgets.map((b) => {
          const spent = spentFor(b, txns);
          const pct = Math.min(100, Math.round((spent / b.amount) * 100));
          const over = spent > b.amount;
          const isTag = b.track === 'tag';
          const tg = isTag ? tagOf(b.tagId) : null;
          const color = isTag ? (tg ? tg.color : '#888') : catColor(b.category);
          const label = isTag ? (tg ? tg.name : 'tag') : b.category;
          return (
            <div className={`bud-card${over ? ' over' : ''}`} key={b.id}>
              <button className={`kebab${menu === b.id ? ' open' : ''}`} aria-label="Budget actions" onClick={() => setMenu(menu === b.id ? null : b.id)}><B d={BI.kebab} fill /></button>
              {menu === b.id && <RowMenu onEdit={() => { setEditing(b); setMenu(null); }} onDel={() => del(b.id)} onHistory={b.recurring ? () => { setHistory(b); setMenu(null); } : undefined} onClose={() => setMenu(null)} />}
              <div className="bud-top">
                <span className="bud-ic" style={{ background: color }}>{isTag ? '#' : label.charAt(0)}</span>
                <div className="bud-id">
                  <b>{b.name}</b>
                  <span className="chip-row">
                    <span className="tchip"><i style={{ background: color }} />{isTag ? '#' : ''}{label} · {b.timeframe}</span>
                    {b.recurring && <span className="tchip recur" title={`Auto-renews every ${periodNoun(b.timeframe)}`}><B d={BI.recur} />Recurring</span>}
                  </span>
                </div>
              </div>
              <div>
                <div className="track"><i style={{ width: `${pct}%`, background: over ? '#c02626' : 'var(--primary)' }} /></div>
                <div className="bud-figs">
                  <span className="spent">{money(spent)} <small>/ {money(b.amount)}</small></span>
                  <span className="pct">{pct}%</span>
                </div>
              </div>
              <div className="bud-foot">
                <span className={`left${over ? ' over' : ''}`}>{over ? `${money(spent - b.amount)} over` : `${money(b.amount - spent)} left`}</span>
                {isTag && <span className={`mode-pill ${b.mode}`}>{b.mode === 'parallel' ? 'Parallel' : 'Isolated'}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && <BudgetModal key={editing.id || 'new'} initial={editing} tags={tags} cats={cats} onSave={save} onClose={() => setEditing(null)} />}
      {history && <HistoryModal budget={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
