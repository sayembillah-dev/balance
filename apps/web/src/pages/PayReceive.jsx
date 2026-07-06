/* Balance — Pay & Receive.
   Two tabs: Receivables (money owed to you) and Payables (money you owe).
   Create / edit / delete, mark settled / unmark, totals.
   Settled items auto-archive; archive panel accessible via the Archive button. */
import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, PencilSimple, Trash, Check, ArrowCounterClockwise, ArrowDownLeft, ArrowUpRight, Clock, Wallet, ArrowsClockwise, Archive } from '@phosphor-icons/react';
import ThreeDots from '../components/ThreeDots.jsx';
import DatePicker from '../components/DatePicker.jsx';
import AmountInput from '../components/AmountInput.jsx';

const PIco = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const PI = {
  plus: Plus, x: X, kebab: ThreeDots, edit: PencilSimple, trash: Trash, check: Check,
  undo: ArrowCounterClockwise, in: ArrowDownLeft, out: ArrowUpRight, clock: Clock,
  wallet: Wallet, recur: ArrowsClockwise, archive: Archive,
};
const RECUR_OPTS = [{ value: '', label: 'One-off' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }];
const recurLabel = (r) => (r === 'weekly' ? 'Repeats weekly' : r === 'monthly' ? 'Repeats monthly' : 'Recurring');
const STORE = 'balance.payrecv.v1';
const fmtDate = (iso) => window.BAL.fmtDate(iso);
const grp = (n) => Math.abs(n).toLocaleString('en-IN');
const RECV_C = '#15803d', PAY_C = '#c0606a';

const SEED = [
  { id: 'p1', kind: 'receivable', party: 'Rohan Mehta',     amount: 4500,  due: '2025-07-05', note: 'Split — Goa trip',      settled: false },
  { id: 'p2', kind: 'receivable', party: 'Acme Corp',       amount: 32000, due: '2025-06-20', note: 'Invoice #1042',         settled: false },
  { id: 'p3', kind: 'receivable', party: 'Priya Sharma',    amount: 1200,  due: '2025-06-12', note: 'Concert tickets',       settled: true,  settledOn: '2025-06-14' },
  { id: 'p4', kind: 'payable',    party: 'Landlord',        amount: 28000, due: '2025-07-01', note: 'July rent',             settled: false },
  { id: 'p5', kind: 'payable',    party: 'Karan (friend)',  amount: 2500,  due: '2025-06-18', note: 'Borrowed for dinner',   settled: false },
  { id: 'p6', kind: 'payable',    party: 'Electricity',     amount: 1265,  due: '2025-06-10', note: 'June bill',             settled: true,  settledOn: '2025-06-09' },
];

const load = () => window.BAL.loadPayRecv();
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

function ItemModal({ initial, kind, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const rec = f.recurrence || '';
  const noun = kind === 'receivable' ? 'receivable' : 'payable';
  const valid = f.party.trim() && f.amount && !(rec && !f.due);
  const [saving, setSaving] = useState(false);
  const save = () => { if (!valid) return; setSaving(true); onSave({ ...f, party: f.party.trim(), amount: Math.abs(Number(f.amount)) }); };
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
              <label>Amount ({window.BAL.sym()})</label>
              <AmountInput value={f.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="field">
              <label>Due date{rec && <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}> (required)</span>}</label>
              <DatePicker value={f.due} onChange={(v) => set('due', v)} />
            </div>
          </div>
          <div className="field">
            <label>Repeat</label>
            <div className="track-seg recur-seg">
              {RECUR_OPTS.map((o) => (
                <button type="button" key={o.label} className={rec === o.value ? 'on' : ''} onClick={() => set('recurrence', o.value)}>
                  {o.value && <PIco d={PI.recur} />}{o.label}
                </button>
              ))}
            </div>
            {rec && <p className="recur-hint">The next {noun} is created automatically every {rec === 'weekly' ? 'week' : 'month'} once each due date arrives.</p>}
          </div>
          <div className="field">
            <label>Note <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label>
            <input value={f.note} placeholder="What is this for?" onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!valid || saving}>{saving ? <><span className="btn-spin" />{initial.id ? 'Saving…' : 'Adding…'}</> : initial.id ? 'Save changes' : `Add ${noun}`}</button>
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
  const overdue = !it.settled && it.due && it.due < window.BAL.today();
  return (
    <div className="pr-item">
      <div className="pr-av" style={{ background: tint(c), color: inkc(c) }}>{it.party.charAt(0).toUpperCase()}</div>
      <div className="pr-content">
        <div className="pr-row1">
          <div className="pr-mid">
            <b>{it.party}</b>
            <div className="sub">
              {overdue
                ? <><span className="pr-badge overdue"><PIco d={PI.clock} />Overdue</span><span className="when">{fmtDate(it.due)}</span></>
                : <><span className="pr-badge pending"><PIco d={PI.clock} />Due</span><span className="when">{fmtDate(it.due)}</span></>}
              {(it.recurrence || it.seriesId) && <span className="pr-badge recur" title={recurLabel(it.recurrence)}><PIco d={PI.recur} />{recurLabel(it.recurrence)}</span>}
              {it.note && <span className="dot-sep">·</span>}
              {it.note && <span className="note">{it.note}</span>}
            </div>
          </div>
          <div className={`pr-amt ${recv ? 'recv' : 'pay'}`}>{window.BAL.fmt(it.amount)}</div>
        </div>
        <div className="pr-actions">
          <button className="btn-sm solid" onClick={() => onToggle(it.id)}><PIco d={PI.check} />{recv ? 'Mark received' : 'Mark paid'}</button>
          <div style={{ position: 'relative' }}>
            <button className={`kebab${menuOpen ? ' open' : ''}`} aria-label="Actions" onClick={() => setMenu(menuOpen ? null : it.id)}><PIco d={PI.kebab} fill /></button>
            {menuOpen && <RowMenu onEdit={() => { onEdit(it); setMenu(null); }} onDel={() => onDel(it.id)} onClose={() => setMenu(null)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchivePanel({ items, kind, onUnmark, onClose }) {
  const recv = kind === 'receivable';
  const c = recv ? RECV_C : PAY_C;
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="archive-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lib-head">
          <div>
            <h3>Archive</h3>
            <p>{items.length} {recv ? 'received' : 'paid'} {items.length === 1 ? 'item' : 'items'}</p>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><PIco d={PI.x} /></button>
        </div>
        {items.length === 0 ? (
          <div className="pr-empty" style={{ margin: '16px 18px', borderRadius: 12 }}>
            <b>No archived items</b>
            <span>Settled {recv ? 'receivables' : 'payables'} will appear here automatically.</span>
          </div>
        ) : (
          <div className="archive-list">
            {items.map((it) => (
              <div key={it.id} className="pr-item settled">
                <div className="pr-av" style={{ background: tint(c), color: inkc(c) }}>{it.party.charAt(0).toUpperCase()}</div>
                <div className="pr-content">
                  <div className="pr-row1">
                    <div className="pr-mid">
                      <b>{it.party}</b>
                      <div className="sub">
                        <span className="pr-badge done"><PIco d={PI.check} />{recv ? 'Received' : 'Paid'}</span>
                        <span className="when">{fmtDate(it.settledOn)}</span>
                        {it.note && <><span className="dot-sep">·</span><span className="note">{it.note}</span></>}
                      </div>
                    </div>
                    <div className="pr-amt">{window.BAL.fmt(it.amount)}</div>
                  </div>
                  <div className="pr-actions">
                    <button className="btn-sm ghost" onClick={() => onUnmark(it.id)}><PIco d={PI.undo} />Unmark</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => { window.BAL.savePayRecv(items); }, [items]);

  const save = (it) => {
    setItems((all) => it.id ? all.map((x) => x.id === it.id ? it : x) : [{ ...it, id: window.BAL.newId() }, ...all]);
    setEditing(null);
  };
  const del = (id) => { setItems((all) => all.filter((x) => x.id !== id)); setMenu(null); };
  const toggle = (id) => setItems((all) => all.map((x) => x.id === id ? { ...x, settled: !x.settled, settledOn: !x.settled ? window.BAL.today() : null } : x));

  const list = items.filter((x) => x.kind === kind);
  const active = list.filter((x) => !x.settled);
  const archived = list.filter((x) => x.settled);
  const outstanding = active.reduce((s, x) => s + x.amount, 0);
  const settledSum = archived.reduce((s, x) => s + x.amount, 0);
  const overdue = active.filter((x) => x.due && x.due < window.BAL.today()).length;
  const sorted = [...active].sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  const recv = kind === 'receivable';
  const blank = { kind, party: '', amount: '', due: window.BAL.today(), note: '', settled: false, recurrence: '' };

  return (
    <div className="pr">
      <div className="txn-head">
        <div><h2>Pay &amp; Receive</h2><p>Track who owes you and what you owe</p></div>
        <button className="btn-primary" onClick={() => setEditing(blank)}><PIco d={PI.plus} />New {recv ? 'receivable' : 'payable'}</button>
      </div>

      <div className="pr-tab-bar">
        <div className="cat-tabs">
          <button className={recv ? 'on' : ''} onClick={() => setKind('receivable')}><span className="dot" style={{ background: RECV_C }} />Receivables</button>
          <button className={!recv ? 'on' : ''} onClick={() => setKind('payable')}><span className="dot" style={{ background: PAY_C }} />Payables</button>
        </div>
        <button className="pr-archive-btn" onClick={() => setArchiveOpen(true)} title="View archived items">
          <PIco d={PI.archive} />
          Archive
          {archived.length > 0 && <span className="pr-archive-count">{archived.length}</span>}
        </button>
      </div>

      <div className="acct-sum">
        <Tile icon={recv ? PI.in : PI.out} label={recv ? 'To collect' : 'To pay'} value={`${window.BAL.fmt(outstanding)}`} cls={recv ? 'in' : 'out'} />
        <Tile icon={PI.check} label={recv ? 'Received' : 'Paid'} value={`${window.BAL.fmt(settledSum)}`} />
        <Tile icon={PI.clock} label="Overdue" value={overdue} cls={overdue ? 'out' : ''} />
      </div>

      {sorted.length === 0 ? (
        <div className="pr-empty"><b>Nothing pending</b><span>{archived.length > 0 ? `All ${recv ? 'receivables' : 'payables'} are settled — check the archive.` : `Add a ${recv ? 'receivable' : 'payable'} to start tracking it.`}</span></div>
      ) : (
        <div className="pr-list">
          {sorted.map((it) => (
            <Item key={it.id} it={it} onToggle={toggle} onEdit={setEditing} onDel={del} menuOpen={menu === it.id} setMenu={setMenu} />
          ))}
        </div>
      )}

      {archiveOpen && <ArchivePanel items={archived} kind={kind} onUnmark={toggle} onClose={() => setArchiveOpen(false)} />}
      {editing && <ItemModal key={editing.id || 'new'} initial={editing} kind={editing.kind} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
