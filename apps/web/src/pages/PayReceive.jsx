/* Balance — Pay & Receive.
   Two tabs: Receivables (money owed to you) and Payables (money you owe).
   Create / edit / delete, mark settled / unmark, totals. */
import React, { useState, useEffect, useRef } from 'react';

const PIco = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const PI = {
  plus:   ['M12 5v14', 'M5 12h14'],
  x:      ['M6 6l12 12', 'M18 6 6 18'],
  kebab:  ['M12 5.5h.01', 'M12 12h.01', 'M12 18.5h.01'],
  edit:   ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  trash:  ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  check:  ['M5 12.5 10 17l9-10'],
  undo:   ['M9 7 4 12l5 5', 'M4 12h11a5 5 0 0 1 0 10h-1'],
  in:     ['M7 7v10h10', 'M7 17 17 7'],
  out:    ['M17 17V7H7', 'M17 7 7 17'],
  clock:  ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.5V12l3 2'],
  wallet: ['M3 7a2 2 0 0 1 2-2h12a1.5 1.5 0 0 1 1.5 1.5V7', 'M3 7v10a2 2 0 0 0 2 2h13a1.5 1.5 0 0 0 1.5-1.5V10A1.5 1.5 0 0 0 18 8.5H5a2 2 0 0 1-2-1.5'],
};
const STORE = 'balance.payrecv.v1';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const grp = (n) => Math.abs(n).toLocaleString('en-IN');
const TODAY = '2025-06-30';
const RECV_C = '#15803d', PAY_C = '#c0606a';

const SEED = [
  { id: 'p1', kind: 'receivable', party: 'Rohan Mehta',     amount: 4500,  due: '2025-07-05', note: 'Split — Goa trip',      settled: false },
  { id: 'p2', kind: 'receivable', party: 'Acme Corp',       amount: 32000, due: '2025-06-20', note: 'Invoice #1042',         settled: false },
  { id: 'p3', kind: 'receivable', party: 'Priya Sharma',    amount: 1200,  due: '2025-06-12', note: 'Concert tickets',       settled: true,  settledOn: '2025-06-14' },
  { id: 'p4', kind: 'payable',    party: 'Landlord',        amount: 28000, due: '2025-07-01', note: 'July rent',             settled: false },
  { id: 'p5', kind: 'payable',    party: 'Karan (friend)',  amount: 2500,  due: '2025-06-18', note: 'Borrowed for dinner',   settled: false },
  { id: 'p6', kind: 'payable',    party: 'Electricity',     amount: 1265,  due: '2025-06-10', note: 'June bill',             settled: true,  settledOn: '2025-06-09' },
];

const load = () => { try { const s = JSON.parse(localStorage.getItem(STORE)); if (Array.isArray(s)) return s; } catch (e) {} return SEED.map((x) => ({ ...x })); };
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

function ItemModal({ initial, kind, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => { if (!f.party.trim() || !f.amount) return; onSave({ ...f, party: f.party.trim(), amount: Math.abs(Number(f.amount)) }); };
  const noun = kind === 'receivable' ? 'receivable' : 'payable';
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? `Edit ${noun}` : `New ${noun}`}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><PIco d={PI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>{kind === 'receivable' ? 'Owed by' : 'Owed to'}</label>
            <input autoFocus value={f.party} placeholder="e.g. Rohan Mehta" onChange={(e) => set('party', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Amount (₹)</label>
              <input type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={f.due} onChange={(e) => set('due', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Note <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label>
            <input value={f.note} placeholder="What is this for?" onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{initial.id ? 'Save changes' : `Add ${noun}`}</button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ onEdit, onDel, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="menu" ref={ref} style={{ top: 38 }}>
      <button onClick={onEdit}><PIco d={PI.edit} />Edit</button>
      <div className="sep" />
      <button className="danger" onClick={onDel}><PIco d={PI.trash} />Delete</button>
    </div>
  );
}

function Item({ it, onToggle, onEdit, onDel, menuOpen, setMenu }) {
  const recv = it.kind === 'receivable';
  const c = recv ? RECV_C : PAY_C;
  const overdue = !it.settled && it.due && it.due < TODAY;
  return (
    <div className={`pr-item${it.settled ? ' settled' : ''}`}>
      <div className="pr-av" style={{ background: tint(c), color: inkc(c) }}>{it.party.charAt(0).toUpperCase()}</div>
      <div className="pr-mid">
        <b>{it.party}</b>
        <div className="sub">
          {it.settled
            ? <><span className="pr-badge done"><PIco d={PI.check} />{recv ? 'Received' : 'Paid'}</span><span className="when">{fmtDate(it.settledOn)}</span></>
            : overdue
              ? <><span className="pr-badge overdue"><PIco d={PI.clock} />Overdue</span><span className="when">{fmtDate(it.due)}</span></>
              : <><span className="pr-badge pending"><PIco d={PI.clock} />Due</span><span className="when">{fmtDate(it.due)}</span></>}
          {it.note && <span className="dot-sep">·</span>}
          {it.note && <span className="note">{it.note}</span>}
        </div>
      </div>
      <div className="pr-right">
        <div className={`pr-amt ${recv ? 'recv' : 'pay'}`}>₹{grp(it.amount)}</div>
        <div className="pr-actions">
          {it.settled
            ? <button className="btn-sm ghost" onClick={() => onToggle(it.id)}><PIco d={PI.undo} />Unmark</button>
            : <button className="btn-sm solid" onClick={() => onToggle(it.id)}><PIco d={PI.check} />{recv ? 'Mark received' : 'Mark paid'}</button>}
          <div style={{ position: 'relative' }}>
            <button className={`kebab${menuOpen ? ' open' : ''}`} aria-label="Actions" onClick={() => setMenu(menuOpen ? null : it.id)}><PIco d={PI.kebab} fill /></button>
            {menuOpen && <RowMenu onEdit={() => { onEdit(it); setMenu(null); }} onDel={() => onDel(it.id)} onClose={() => setMenu(null)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, cls }) {
  return <div className="tile"><div className="tlab"><span className="tic"><PIco d={icon} /></span>{label}</div><b className={cls}>{value}</b></div>;
}

export default function PayReceive() {
  const [items, setItems] = useState(load());
  const [kind, setKind] = useState('receivable');
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(items)); }, [items]);

  const save = (it) => {
    setItems((all) => it.id ? all.map((x) => x.id === it.id ? it : x) : [{ ...it, id: 'p_' + Date.now() }, ...all]);
    setEditing(null);
  };
  const del = (id) => { setItems((all) => all.filter((x) => x.id !== id)); setMenu(null); };
  const toggle = (id) => setItems((all) => all.map((x) => x.id === id ? { ...x, settled: !x.settled, settledOn: !x.settled ? TODAY : null } : x));

  const list = items.filter((x) => x.kind === kind);
  const pending = list.filter((x) => !x.settled);
  const settled = list.filter((x) => x.settled);
  const outstanding = pending.reduce((s, x) => s + x.amount, 0);
  const settledSum = settled.reduce((s, x) => s + x.amount, 0);
  const overdue = pending.filter((x) => x.due && x.due < TODAY).length;
  const sorted = [...list].sort((a, b) => (a.settled - b.settled) || (a.due || '').localeCompare(b.due || ''));

  const recv = kind === 'receivable';
  const blank = { kind, party: '', amount: '', due: TODAY, note: '', settled: false };

  return (
    <div className="pr">
      <div className="txn-head">
        <div><h2>Pay &amp; Receive</h2><p>Track who owes you and what you owe</p></div>
        <button className="btn-primary" onClick={() => setEditing(blank)}><PIco d={PI.plus} />New {recv ? 'receivable' : 'payable'}</button>
      </div>

      <div className="cat-tabs">
        <button className={recv ? 'on' : ''} onClick={() => setKind('receivable')}><span className="dot" style={{ background: RECV_C }} />Receivables</button>
        <button className={!recv ? 'on' : ''} onClick={() => setKind('payable')}><span className="dot" style={{ background: PAY_C }} />Payables</button>
      </div>

      <div className="acct-sum">
        <Tile icon={recv ? PI.in : PI.out} label={recv ? 'To collect' : 'To pay'} value={`₹${grp(outstanding)}`} cls={recv ? 'in' : 'out'} />
        <Tile icon={PI.check} label={recv ? 'Received' : 'Paid'} value={`₹${grp(settledSum)}`} />
        <Tile icon={PI.clock} label="Overdue" value={overdue} cls={overdue ? 'out' : ''} />
      </div>

      {sorted.length === 0 ? (
        <div className="pr-empty"><b>Nothing here yet</b><span>Add a {recv ? 'receivable' : 'payable'} to start tracking it.</span></div>
      ) : (
        <div className="pr-list">
          {sorted.map((it) => (
            <Item key={it.id} it={it} onToggle={toggle} onEdit={setEditing} onDel={del} menuOpen={menu === it.id} setMenu={setMenu} />
          ))}
        </div>
      )}

      {editing && <ItemModal key={editing.id || 'new'} initial={editing} kind={editing.kind} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
