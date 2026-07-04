/* Balance — Notes. Create / edit / delete simple notes or to-do lists. */
import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, PencilSimple, Trash, Check, Note, ListChecks } from '@phosphor-icons/react';
import ThreeDots from '../components/ThreeDots.jsx';

const NIco = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const NI = {
  plus: Plus, x: X, kebab: ThreeDots, edit: PencilSimple, trash: Trash,
  check: Check, note: Note, todo: ListChecks,
};
const STORE = 'balance.notes.v1';
const COLORS = [
  '#2f6fe0', '#0284c7', '#0e7490', '#1d4ed8',
  '#7c4dd8', '#9333ea', '#4f46e5', '#7e22ce',
  '#138a72', '#0d9488', '#16a34a', '#15803d',
  '#e0892f', '#b45309', '#d97706', '#ca8a04',
  '#d6457a', '#c0606a', '#e11d48', '#dc2626',
  '#64748b', '#475569',
];
const fmtWhen = (iso) => window.BAL.fmtDate(iso, { withYear: false });
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const NOW = '2025-06-30T10:00:00';

const SEED = [
  { id: 'n1', type: 'note', color: '#e0892f', title: 'Tax filing reminders', body: 'Collect Form 16 from HR.\nDownload AIS + 26AS from the portal.\nClaim 80C: ELSS ₹50k, PPF ₹40k.\nDeadline: 31 July.', updated: '2025-06-28T09:00:00' },
  { id: 'n2', type: 'todo', color: '#138a72', title: 'This month', items: [
    { id: 's1', text: 'Pay credit card bill', done: true },
    { id: 's2', text: 'Renew bike insurance', done: false },
    { id: 's3', text: 'Move ₹20k to savings', done: false },
    { id: 's4', text: 'Review subscriptions', done: false },
  ], updated: '2025-06-29T18:30:00' },
  { id: 'n3', type: 'note', color: '#2f6fe0', title: 'Goa trip budget', body: 'Flights: ₹9,000\nStay (3 nights): ₹12,000\nFood + activities: ₹8,000\nSplit 4 ways ≈ ₹7,250 each.', updated: '2025-06-25T12:00:00' },
];

const load = () => window.BAL.loadNotes();

function NoteModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isNote = f.type === 'note';
  const save = () => {
    if (!f.title.trim() && (isNote ? !(f.body || '').trim() : true)) { if (!f.title.trim()) return; }
    setSaving(true); onSave({ ...f, title: f.title.trim() });
  };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? `Edit ${isNote ? 'note' : 'to-do'}` : `New ${isNote ? 'note' : 'to-do'}`}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><NIco d={NI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Title</label>
            <input autoFocus value={f.title} placeholder={isNote ? 'e.g. Tax reminders' : 'e.g. This week'} onChange={(e) => set('title', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isNote) save(); }} />
          </div>
          {isNote && (
            <div className="field">
              <label>Note</label>
              <textarea value={f.body || ''} rows={7} placeholder="Write something…" onChange={(e) => set('body', e.target.value)}
                style={{ resize: 'vertical', minHeight: 120, border: '1px solid var(--border)', borderRadius: 10, padding: 11, fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', outline: 'none', lineHeight: 1.55 }} />
            </div>
          )}
          <div className="field">
            <label>Colour</label>
            <div className="swatches">
              {COLORS.map((c) => <button key={c} type="button" className={`sw${f.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <><span className="btn-spin" />{initial.id ? 'Saving…' : 'Creating…'}</> : initial.id ? 'Save changes' : 'Create'}</button>
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
    <div className="menu" ref={ref} style={{ top: 36 }}>
      <button onClick={onEdit}><NIco d={NI.edit} />Edit</button>
      <div className="sep" />
      <button className="danger" onClick={onDel}><NIco d={NI.trash} />Delete</button>
    </div>
  );
}

function Card({ n, onEdit, onDel, onToggleItem, onAddItem, onDelItem, menuOpen, setMenu }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t) return; onAddItem(n.id, t); setDraft(''); };
  const done = n.items ? n.items.filter((i) => i.done).length : 0;
  return (
    <div className="note-card">
      <div className="note-card-h">
        <span className="note-chip" style={{ background: n.color }}><NIco d={n.type === 'todo' ? NI.todo : NI.note} /></span>
        <div className="note-h-id">
          <b className={n.title ? '' : 'empty'}>{n.title || 'Untitled'}</b>
          <span>{n.type === 'todo' ? `${done}/${n.items.length} done` : `Edited ${fmtWhen(n.updated)}`}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button className={`kebab${menuOpen ? ' open' : ''}`} aria-label="Actions" onClick={() => setMenu(menuOpen ? null : n.id)}><NIco d={NI.kebab} fill /></button>
          {menuOpen && <RowMenu onEdit={() => { onEdit(n); setMenu(null); }} onDel={() => onDel(n.id)} onClose={() => setMenu(null)} />}
        </div>
      </div>

      {n.type === 'note' ? (
        <div className={`note-body${(n.body || '').trim() ? '' : ' empty'}`} onClick={() => onEdit(n)}>{(n.body || '').trim() || 'Empty note — click to add text.'}</div>
      ) : (
        <>
          <div className="todo-list">
            {n.items.length === 0 && <div className="note-empty-todo">No tasks yet. Add one below.</div>}
            {n.items.map((it) => (
              <div className={`todo-row${it.done ? ' done' : ''}`} key={it.id}>
                <button className={`todo-check${it.done ? ' on' : ''}`} onClick={() => onToggleItem(n.id, it.id)} aria-label="Toggle"><NIco d={NI.check} /></button>
                <span className="t">{it.text}</span>
                <button className="todo-del" onClick={() => onDelItem(n.id, it.id)} aria-label="Delete task"><NIco d={NI.x} /></button>
              </div>
            ))}
          </div>
          <div className="todo-add">
            <input value={draft} placeholder="Add task…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button onClick={add}>Add</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState(load());
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);

  useEffect(() => { window.BAL.saveNotes(notes); }, [notes]);

  // Open the New note modal when triggered from the dashboard Quick Actions.
  useEffect(() => {
    const h = () => setEditing({ type: 'note', title: '', body: '', color: COLORS[0] });
    window.addEventListener('balance:new-note', h);
    return () => window.removeEventListener('balance:new-note', h);
  }, []);

  const save = (n) => {
    setNotes((all) => n.id ? all.map((x) => x.id === n.id ? { ...n, updated: NOW } : x) : [{ ...n, id: window.BAL.newId(), updated: NOW }, ...all]);
    setEditing(null);
  };
  const del = (id) => { setNotes((all) => all.filter((x) => x.id !== id)); setMenu(null); };
  const mutItems = (id, fn) => setNotes((all) => all.map((x) => x.id === id ? { ...x, items: fn(x.items), updated: NOW } : x));
  const toggleItem = (id, sid) => mutItems(id, (its) => its.map((i) => i.id === sid ? { ...i, done: !i.done } : i));
  const addItem = (id, text) => mutItems(id, (its) => [...its, { id: uid('s_'), text, done: false }]);
  const delItem = (id, sid) => mutItems(id, (its) => its.filter((i) => i.id !== sid));

  const newNote = () => setEditing({ type: 'note', title: '', body: '', color: COLORS[0] });
  const newTodo = () => setEditing({ type: 'todo', title: '', items: [], color: COLORS[2] });

  return (
    <div className="notes">
      <div className="txn-head">
        <div><h2>Notes</h2><p>Jot down notes and to-do lists</p></div>
        <div className="dash-actions">
          <button className="btn-ghost" onClick={newTodo}><NIco d={NI.todo} />New to-do</button>
          <button className="btn-primary" onClick={newNote}><NIco d={NI.plus} />New note</button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="notes-empty">
          <span className="pic"><NIco d={NI.note} /></span>
          <b>No notes yet</b>
          <span>Create a note or a to-do list to get started.</span>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map((n) => (
            <Card key={n.id} n={n} onEdit={setEditing} onDel={del}
              onToggleItem={toggleItem} onAddItem={addItem} onDelItem={delItem}
              menuOpen={menu === n.id} setMenu={setMenu} />
          ))}
        </div>
      )}

      {editing && <NoteModal key={editing.id || 'new'} initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
