/* Balance — Categories page.
   Income/Expense types, categories with sub-categories. Create / edit / delete
   categories & subs; hide subs (eye) so they drop out of the transaction modal. */
import React, { useState, useEffect } from 'react';

const CIco = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const CI = {
  edit:   ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  trash:  ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  plus:   ['M12 5v14', 'M5 12h14'],
  eye:    ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeoff: ['m3 3 18 18', 'M10.6 10.7a3 3 0 0 0 4.1 4.1', 'M9.4 5.2A9.4 9.4 0 0 1 12 5c6.4 0 10 7 10 7a16.3 16.3 0 0 1-2.9 3.8', 'M6.2 6.3A16.1 16.1 0 0 0 2 12s3.6 7 10 7a9.3 9.3 0 0 0 3.4-.6'],
  check:  ['M5 12.5 10 17l9-10'],
  go:     ['M9 6l6 6-6 6'],
  x:      ['M6 6l12 12', 'M18 6 6 18'],
  inc:    ['M7 17 17 7', 'M9 7h8v8'],
  exp:    ['M17 7 7 17', 'M15 17H7V9'],
};
const COLORS = ['#e0892f', '#3aa3a3', '#7c4dd8', '#2f6fe0', '#d6457a', '#c0606a', '#16a34a', '#138a72', '#0e7490', '#64748b', '#b45309', '#9333ea'];

function CatModal({ initial, type, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => { if (!f.name.trim()) return; onSave({ ...f, name: f.name.trim() }); };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? 'Edit category' : `New ${type} category`}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><CIco d={CI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Category name</label>
            <input autoFocus value={f.name} placeholder="e.g. Education" onChange={(e) => set('name', e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="field">
            <label>Colour</label>
            <div className="swatches">
              {COLORS.map((c) => <button key={c} type="button" className={`sw${f.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{initial.id ? 'Save changes' : 'Add category'}</button>
        </div>
      </div>
    </div>
  );
}

function SubRow({ sub, color, editing, onEdit, onRename, onCancel, onToggle, onDel }) {
  const [val, setVal] = useState(sub.name);
  useEffect(() => { setVal(sub.name); }, [editing, sub.name]);
  if (editing) {
    return (
      <div className="sub-row">
        <div className="sub-edit">
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') onRename(val); if (e.key === 'Escape') onCancel(); }} />
          <button className="icon-mini" onClick={() => onRename(val)} aria-label="Save"><CIco d={CI.check} /></button>
          <button className="icon-mini" onClick={onCancel} aria-label="Cancel"><CIco d={CI.x} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className={`sub-row${sub.hidden ? ' is-hidden' : ''}`}>
      <span className="sub-dot" style={{ background: color }} />
      <span className="sname">{sub.name}</span>
      {sub.hidden && <span className="htag">Hidden</span>}
      <div className="sub-acts">
        <button className="icon-mini" onClick={onToggle} title={sub.hidden ? 'Show in transactions' : 'Hide from transactions'} aria-label="Toggle visibility">
          <CIco d={sub.hidden ? CI.eyeoff : CI.eye} />
        </button>
        <button className="icon-mini" onClick={onEdit} title="Rename" aria-label="Rename"><CIco d={CI.edit} /></button>
        <button className="icon-mini danger" onClick={onDel} title="Delete" aria-label="Delete"><CIco d={CI.trash} /></button>
      </div>
    </div>
  );
}

function CatCard({ cat, onEditCat, onDelCat, onManage }) {
  return (
    <div className="cat-card cat-card-click" onClick={() => onManage(cat.id)}>
      <div className="cat-card-h">
        <span className="cat-chip" style={{ background: cat.color }}>{cat.name.charAt(0).toUpperCase()}</span>
        <div className="cat-h-id">
          <b>{cat.name}</b>
          <span>{cat.subs.length} sub-categor{cat.subs.length === 1 ? 'y' : 'ies'}</span>
        </div>
        <div className="cat-h-acts" onClick={(e) => e.stopPropagation()}>
          <button className="icon-mini" onClick={() => onEditCat(cat)} title="Edit category" aria-label="Edit category"><CIco d={CI.edit} /></button>
          <button className="icon-mini danger" onClick={() => onDelCat(cat.id)} title="Delete category" aria-label="Delete category"><CIco d={CI.trash} /></button>
        </div>
        <span className="cat-go"><CIco d={CI.go} /></span>
      </div>
    </div>
  );
}

function SubsModal({ cat, editingSub, setEditingSub, onAddSub, onRenameSub, onDelSub, onToggleSub, onClose }) {
  const [draft, setDraft] = useState('');
  const add = () => { const n = draft.trim(); if (!n) return; onAddSub(cat.id, n); setDraft(''); };
  const hiddenCount = cat.subs.filter((s) => s.hidden).length;
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span className="cat-chip" style={{ background: cat.color, width: 34, height: 34, fontSize: 14 }}>{cat.name.charAt(0).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ lineHeight: 1.15 }}>{cat.name}</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, marginTop: 1 }}>
                {cat.subs.length} sub-categor{cat.subs.length === 1 ? 'y' : 'ies'}{hiddenCount ? ` · ${hiddenCount} hidden` : ''}
              </p>
            </div>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><CIco d={CI.x} /></button>
        </div>
        <div className="modal-body" style={{ padding: '8px 10px', gap: 0 }}>
          {cat.subs.length === 0 && <div className="sub-empty">No sub-categories yet. Add one below.</div>}
          {cat.subs.map((s) => (
            <SubRow key={s.id} sub={s} color={cat.color}
              editing={editingSub && editingSub.catId === cat.id && editingSub.subId === s.id}
              onEdit={() => setEditingSub({ catId: cat.id, subId: s.id })}
              onRename={(name) => onRenameSub(cat.id, s.id, name)}
              onCancel={() => setEditingSub(null)}
              onToggle={() => onToggleSub(cat.id, s.id)}
              onDel={() => onDelSub(cat.id, s.id)} />
          ))}
        </div>
        <div className="sub-add">
          <input autoFocus value={draft} placeholder="Add sub-category…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={add}><CIco d={CI.plus} />Add</button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const [cats, setCats] = useState(window.BAL.loadCategories());
  const [type, setType] = useState('expense');
  const [editingCat, setEditingCat] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [managing, setManaging] = useState(null);

  useEffect(() => { window.BAL.saveCategories(cats); }, [cats]);

  const newSub = (name) => ({ id: window.BAL.newId(), name, hidden: false });
  const saveCat = (c) => {
    setCats((all) => c.id ? all.map((x) => x.id === c.id ? { ...x, ...c } : x)
      : [...all, { id: window.BAL.newId(), type, color: c.color, name: c.name, subs: [] }]);
    setEditingCat(null);
  };
  const delCat = (id) => setCats((all) => all.filter((x) => x.id !== id));
  const mut = (catId, fn) => setCats((all) => all.map((c) => c.id === catId ? { ...c, subs: fn(c.subs) } : c));
  const addSub = (catId, name) => mut(catId, (subs) => [...subs, newSub(name)]);
  const renameSub = (catId, subId, name) => { if (name.trim()) mut(catId, (subs) => subs.map((s) => s.id === subId ? { ...s, name: name.trim() } : s)); setEditingSub(null); };
  const delSub = (catId, subId) => mut(catId, (subs) => subs.filter((s) => s.id !== subId));
  const toggleSub = (catId, subId) => mut(catId, (subs) => subs.map((s) => s.id === subId ? { ...s, hidden: !s.hidden } : s));

  const list = cats.filter((c) => c.type === type);
  const blank = { name: '', color: COLORS[type === 'income' ? 6 : 0] };
  const managed = cats.find((c) => c.id === managing);

  return (
    <div className="cat">
      <div className="txn-head">
        <div><h2>Categories</h2><p>Organise income & expenses into categories and sub-categories</p></div>
        <button className="btn-primary" onClick={() => setEditingCat(blank)}><CIco d={CI.plus} />New category</button>
      </div>

      <div className="cat-tabs">
        <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>
          <span className="dot" style={{ background: '#c0606a' }} />Expense
        </button>
        <button className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>
          <span className="dot" style={{ background: '#15803d' }} />Income
        </button>
      </div>

      <div className="cat-grid">
        {list.map((c) => (
          <CatCard key={c.id} cat={c} onEditCat={setEditingCat} onDelCat={delCat} onManage={setManaging} />
        ))}
        <button className="cat-addcard" onClick={() => setEditingCat(blank)}>
          <span className="pl"><CIco d={CI.plus} /></span>
          <span>Add {type} category</span>
        </button>
      </div>

      {managed && (
        <SubsModal cat={managed} editingSub={editingSub} setEditingSub={setEditingSub}
          onAddSub={addSub} onRenameSub={renameSub} onDelSub={delSub} onToggleSub={toggleSub}
          onClose={() => { setManaging(null); setEditingSub(null); }} />
      )}

      {editingCat && <CatModal key={editingCat.id || 'new'} initial={editingCat} type={type} onSave={saveCat} onClose={() => setEditingCat(null)} />}
    </div>
  );
}
