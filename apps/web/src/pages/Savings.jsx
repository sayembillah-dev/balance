/* Balance — Saving & Goals.
   A savings pool funds virtual goal envelopes.
   Unallocated = pool − Σ goal.saved. Create/edit goals, adjust pool, quick-allocate. */
import React, { useState, useEffect, useRef } from 'react';

const S = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const SI = {
  plus:   ['M12 5v14', 'M5 12h14'],
  x:      ['M6 6l12 12', 'M18 6 6 18'],
  kebab:  ['M12 5.5h.01', 'M12 12h.01', 'M12 18.5h.01'],
  edit:   ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  trash:  ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  pool:   ['M3 7a2 2 0 0 1 2-2h12a1.5 1.5 0 0 1 1.5 1.5V7', 'M3 7v10a2 2 0 0 0 2 2h13a1.5 1.5 0 0 0 1.5-1.5V10A1.5 1.5 0 0 0 18 8.5H5a2 2 0 0 1-2-1.5', 'M16.5 13h.01'],
  alloc:  ['M12 3v18', 'M5 8h9a3 3 0 0 1 0 6H5', 'M5 14h11'],
  spark:  ['M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z'],
  cal:    ['M7 3v3', 'M17 3v3', 'M4 8.5h16', 'M5 5.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z'],
  gauge:  ['M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M5 19a9 9 0 1 1 14 0'],
  up:     ['M7 17 17 7', 'M9 7h8v8'],
  check:  ['M5 12.5 10 17l9-10'],
  warn:   ['M12 9v4', 'M12 17h.01', 'M10.3 4 3.5 16a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 12h.01'],
};
const STORE = 'balance.savings.v1';
const NOW = new Date('2025-06-30T00:00:00');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };
const money = (n) => window.BAL.fmt(n);
const EMOJIS = ['💻', '✈️', '🚗', '🏠', '🛟', '🎓', '📱', '💍', '🏖️', '🎮', '💰', '🎯', '📷', '🚲', '🎸'];

const SEED = {
  pool: 980000,
  goals: [
    { id: 'g1', emoji: '💻', title: 'New Macbook Pro', target: 240000, saved: 156000, deadline: '2025-12-31', created: '2025-01-01' },
    { id: 'g2', emoji: '✈️', title: 'Japan Trip 2026', target: 350000, saved: 90000, deadline: '2026-04-01', created: '2025-03-01' },
    { id: 'g3', emoji: '🛟', title: 'Emergency Fund', target: 600000, saved: 480000, deadline: '2025-09-30', created: '2024-06-01' },
    { id: 'g4', emoji: '🚗', title: 'New Car', target: 800000, saved: 120000, deadline: '2027-01-01', created: '2025-05-01' },
  ],
};
const load = () => window.BAL.loadSavings();

const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;

function goalCalc(g) {
  const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
  const remaining = Math.max(0, g.target - g.saved);
  const monthsLeft = monthsBetween(NOW, new Date(g.deadline));
  const done = g.saved >= g.target;
  let velocity, status, perMonth = 0;
  if (done) { velocity = 'Goal reached 🎉'; status = 'done'; }
  else if (monthsLeft <= 0) { velocity = 'Deadline passed — ' + money(remaining) + ' short'; status = 'behind'; }
  else { perMonth = remaining / monthsLeft; velocity = 'Requires ' + money(perMonth) + '/month to hit target'; }
  if (!done && monthsLeft > 0) {
    const created = new Date(g.created || g.deadline);
    const total = Math.max(0.1, monthsBetween(created, new Date(g.deadline)));
    const elapsed = Math.max(0, monthsBetween(created, NOW));
    const expected = Math.min(1, elapsed / total);
    status = (g.saved / g.target) >= expected - 0.02 ? 'ontrack' : 'behind';
  }
  return { pct, remaining, monthsLeft, done, velocity, status, perMonth };
}

function GoalModal({ initial, unalloc, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isNew = !initial.id;
  const initialMax = unalloc;
  const save = () => {
    if (!f.title.trim() || !f.target) return;
    onSave({ ...f, title: f.title.trim(), target: Math.abs(Number(f.target)), saved: isNew ? Math.min(Number(f.saved) || 0, initialMax) : f.saved });
  };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? 'Create new goal' : 'Edit goal'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><S d={SI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Goal name</label>
            <input autoFocus value={f.title} placeholder="e.g. New Macbook Pro" onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="field">
            <label>Icon</label>
            <div className="emoji-pick">
              {EMOJIS.map((e) => <button key={e} type="button" className={f.emoji === e ? 'on' : ''} onClick={() => set('emoji', e)}>{e}</button>)}
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Target amount ({window.BAL.sym()})</label>
              <input type="number" min="0" value={f.target} onChange={(e) => set('target', e.target.value)} />
            </div>
            <div className="field">
              <label>Target date</label>
              <input type="date" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </div>
          </div>
          {isNew && (
            <div className="field">
              <label>Allocate now <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(max {money(initialMax)} unassigned)</span></label>
              <input type="number" min="0" max={initialMax} value={f.saved} onChange={(e) => set('saved', e.target.value)} />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{isNew ? 'Create goal' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function PoolModal({ pool, allocated, onSave, onClose }) {
  const [v, setV] = useState(pool);
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(420px,100%)' }}>
        <div className="modal-head">
          <h3>Total savings pool</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><S d={SI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Cash in savings ({window.BAL.sym()})</label>
            <input type="number" autoFocus min={allocated} value={v} onChange={(e) => setV(e.target.value)} />
          </div>
          <div className="form-hint" style={{ color: 'var(--ink-3)' }}>Already allocated to goals: {money(allocated)}. The pool can’t be lower than this.</div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(Math.max(allocated, Number(v) || 0))}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AllocModal({ goal, unalloc, onSave, onClose }) {
  const max = goal.saved + unalloc;
  const [val, setVal] = useState(goal.saved);
  const delta = val - goal.saved;
  const c = goalCalc({ ...goal, saved: val });
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(440px,100%)' }}>
        <div className="modal-head">
          <div className="alloc-head"><span className="goal-emoji">{goal.emoji}</span><h3>{goal.title}</h3></div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><S d={SI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="alloc-amounts">
            <div><div className="big">{money(val)}</div><span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>of {money(goal.target)} · {c.pct}%</span></div>
            <div className="right"><span>Unassigned after</span><b>{money(unalloc - delta)}</b></div>
          </div>
          <div className="goal-prog"><div className="track"><i style={{ width: `${c.pct}%`, background: 'var(--primary)' }} /></div></div>
          <input className="alloc-slider" type="range" min="0" max={Math.round(max)} step="500" value={val} onChange={(e) => setVal(Number(e.target.value))} />
          <div className="alloc-scale"><span>{money(0)}</span><span>{money(max)}</span></div>
          <div className="alloc-chips">
            <button className="alloc-chip" onClick={() => setVal(Math.min(max, val + 5000))}>+{window.BAL.sym()}5,000</button>
            <button className="alloc-chip" onClick={() => setVal(Math.min(max, val + 25000))}>+{window.BAL.sym()}25,000</button>
            <button className="alloc-chip" onClick={() => setVal(Math.min(max, goal.target))}>Fill to target</button>
            <button className="alloc-chip" onClick={() => setVal(Math.round(max))}>Max</button>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(goal.id, val)} disabled={val === goal.saved}>
            {delta >= 0 ? `Allocate ${money(Math.abs(delta))}` : `Release ${money(Math.abs(delta))}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ onEdit, onDel, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; window.addEventListener('mousedown', h); return () => window.removeEventListener('mousedown', h); }, [onClose]);
  return (
    <div className="menu" ref={ref} style={{ top: 38 }}>
      <button onClick={onEdit}><S d={SI.edit} />Edit goal</button>
      <div className="sep" />
      <button className="danger" onClick={onDel}><S d={SI.trash} />Delete goal</button>
    </div>
  );
}

function HeroCard({ big, accent, icon, label, value, children }) {
  return (
    <div className={`sav-card${big ? ' big' : ''}${accent ? ' accent' : ''}`}>
      <div className="lab"><span className="ic"><S d={icon} /></span>{label}</div>
      <div className="val">{value}</div>
      {children}
    </div>
  );
}

export default function Savings() {
  const [data, setData] = useState(load());
  const [editing, setEditing] = useState(null);
  const [pool, setPool] = useState(null);
  const [alloc, setAlloc] = useState(null);
  const [menu, setMenu] = useState(null);

  useEffect(() => { window.BAL.saveSavings(data); }, [data]);

  const allocated = data.goals.reduce((s, g) => s + g.saved, 0);
  const unalloc = data.pool - allocated;

  const saveGoal = (g) => {
    setData((d) => g.id
      ? { ...d, goals: d.goals.map((x) => x.id === g.id ? { ...x, ...g } : x) }
      : { ...d, goals: [...d.goals, { ...g, id: window.BAL.newId(), created: new Date().toISOString().slice(0, 10) }] });
    setEditing(null);
  };
  const delGoal = (id) => { setData((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== id) })); setMenu(null); };
  const setSaved = (id, v) => { setData((d) => ({ ...d, goals: d.goals.map((x) => x.id === id ? { ...x, saved: Math.max(0, Math.round(v)) } : x) })); setAlloc(null); };

  return (
    <div className="sav">
      <div className="txn-head">
        <div><h2>Saving &amp; Goals</h2><p>Give your savings a job — fund goals from one pool of cash</p></div>
      </div>

      <div className="sav-hero">
        <HeroCard big icon={SI.pool} label="Total Savings Pool" value={money(data.pool)}>
          <button className="adjust" onClick={() => setPool(true)}>Adjust pool</button>
        </HeroCard>
        <HeroCard icon={SI.target} label="Allocated to Goals" value={money(allocated)}>
          <div className="sub">Funding {data.goals.length} active goal{data.goals.length === 1 ? '' : 's'}</div>
        </HeroCard>
        <HeroCard accent icon={SI.alloc} label="Unallocated Savings" value={money(Math.max(0, unalloc))}>
          <span className="assign-badge"><S d={SI.spark} fill />Available to assign</span>
        </HeroCard>
      </div>

      <div className="goals-head">
        <h3>Your Financial Goals</h3>
        <button className="btn-primary" onClick={() => setEditing({ emoji: EMOJIS[0], title: '', target: '', saved: 0, deadline: '2026-01-01' })}><S d={SI.plus} />Create New Goal</button>
      </div>

      <div className="goals-grid">
        {data.goals.map((g) => {
          const c = goalCalc(g);
          const sIco = c.status === 'done' ? SI.check : c.status === 'ontrack' ? SI.up : SI.warn;
          const sLabel = c.status === 'done' ? 'Completed' : c.status === 'ontrack' ? 'On track' : 'Behind pace';
          return (
            <div className="goal-card" key={g.id}>
              <button className={`kebab${menu === g.id ? ' open' : ''}`} aria-label="Goal actions" onClick={() => setMenu(menu === g.id ? null : g.id)}><S d={SI.kebab} fill /></button>
              {menu === g.id && <RowMenu onEdit={() => { setEditing(g); setMenu(null); }} onDel={() => delGoal(g.id)} onClose={() => setMenu(null)} />}
              <div className="goal-top">
                <span className="goal-emoji">{g.emoji}</span>
                <div className="goal-id">
                  <b>{g.title}</b>
                  <span className={`status ${c.status}`}><S d={sIco} />{sLabel}</span>
                </div>
              </div>
              <div className="goal-prog">
                <div className="track"><i style={{ width: `${c.pct}%`, background: c.status === 'behind' ? '#e0892f' : 'var(--primary)' }} /></div>
                <div className="goal-figs">
                  <span className="saved">{money(g.saved)} <small>/ {money(g.target)}</small></span>
                  <span className="pct">{c.pct}%</span>
                </div>
              </div>
              <div className="goal-meta">
                <div className="mrow"><S d={SI.cal} />Target date · {fmtDate(g.deadline)}</div>
                <div className="mrow velocity"><S d={SI.gauge} />{c.velocity}</div>
              </div>
              <div className="goal-actions">
                <button className="btn-sm solid" onClick={() => setAlloc(g)}><S d={SI.alloc} />Quick Allocate</button>
                <button className="btn-sm ghost" onClick={() => setEditing(g)}><S d={SI.edit} />Edit</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <GoalModal key={editing.id || 'new'} initial={editing} unalloc={Math.max(0, unalloc)} onSave={saveGoal} onClose={() => setEditing(null)} />}
      {pool && <PoolModal pool={data.pool} allocated={allocated} onSave={(v) => { setData((d) => ({ ...d, pool: v })); setPool(null); }} onClose={() => setPool(null)} />}
      {alloc && <AllocModal goal={alloc} unalloc={Math.max(0, unalloc)} onSave={setSaved} onClose={() => setAlloc(null)} />}
    </div>
  );
}
