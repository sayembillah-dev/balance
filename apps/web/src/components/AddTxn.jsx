/* Balance — global Add/Edit transaction modal + Presets.
   Opens on `balance:add-txn` (detail: { tab?, txn?: existing, presetFrom?: txn }).
   Saves transactions via window.BAL.saveTxns; presets via window.BAL.savePresets. */
import React, { useState, useEffect } from 'react';
import { apiUpload } from '../lib/api.js';

const X = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const IX = {
  x:        ['M6 6l12 12', 'M18 6 6 18'],
  exp:      ['M17 7 7 17', 'M15 17H7V9'],
  inc:      ['M7 7v10h10', 'M7 17 17 7'],
  transfer: ['M7 7h13', 'm17 4 3 3-3 3', 'M17 17H4', 'm7 14-3 3 3 3'],
  preset:   ['M5 4h14a1 1 0 0 1 1 1v3H4V5a1 1 0 0 1 1-1Z', 'M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z', 'M9 12h6'],
  arrow:    ['M5 12h14', 'm13 6 6 6-6 6'],
  plus:     ['M12 5v14', 'M5 12h14'],
  edit:     ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  trash:    ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  apply:    ['M7 5v14l11-7-11-7Z'],
};
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;
const MODES = ['UPI', 'Card', 'Bank', 'Cash'];
const today = () => new Date().toISOString().slice(0, 10);
const firstCat = (type) => (window.BAL.categoriesByType(type)[0] || {}).name || '';
const money = (n) => window.BAL.fmt(n);

function blankFor(tab, accts) {
  if (tab === 'transfer') return { type: 'transfer', amount: '', fromAccount: accts[0] ? accts[0].id : '', toAccount: accts[1] ? accts[1].id : (accts[0] ? accts[0].id : ''), merchant: '', date: today() };
  const type = tab === 'income' ? 'income' : 'expense';
  return { type, merchant: '', amount: '', category: firstCat(type), subcategory: '', mode: 'UPI', account: accts[0] ? accts[0].id : '', tags: [], date: today() };
}

function TxnFields({ f, set, setCat, toggleTag, accts, tags, catOpts, subOpts }) {
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <select value={f.category} onChange={(e) => setCat(e.target.value)}>
            {catOpts.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sub-category</label>
          <select value={f.subcategory || ''} onChange={(e) => set('subcategory', e.target.value)} disabled={subOpts.length === 0}>
            <option value="">{subOpts.length === 0 ? 'None' : '— none —'}</option>
            {subOpts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Mode</label>
          <select value={f.mode} onChange={(e) => set('mode', e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Account</label>
          <select value={f.account} onChange={(e) => set('account', e.target.value)}>
            {accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Tags</label>
        <div className="tag-pick">
          {tags.map((tg) => {
            const on = (f.tags || []).includes(tg.id);
            return <button type="button" key={tg.id} className="tag-opt" style={on ? { background: tint(tg.color), color: inkc(tg.color), borderColor: 'transparent' } : null} onClick={() => toggleTag(tg.id)}><i style={{ background: tg.color }} />{tg.name}</button>;
          })}
        </div>
      </div>
    </>
  );
}

function PresetEditor({ initial, accts, tags, onSave, onClose }) {
  const [p, setP] = useState(initial);
  const [hasAmt, setHasAmt] = useState(initial.amount != null && initial.amount !== '');
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setType = (v) => setP((x) => ({ ...x, type: v, category: firstCat(v), subcategory: '' }));
  const setCat = (v) => setP((x) => ({ ...x, category: v, subcategory: '' }));
  const toggleTag = (id) => setP((x) => { const cur = x.tags || []; return { ...x, tags: cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id] }; });
  const catOpts = window.BAL.categoriesByType(p.type);
  const subOpts = (catOpts.find((c) => c.name === p.category) || {}).subs || [];
  const valid = p.name.trim() && p.merchant.trim() && (!hasAmt || p.amount);
  const save = () => { if (!valid) return; onSave({ ...p, name: p.name.trim(), merchant: p.merchant.trim(), amount: hasAmt ? Math.abs(Number(p.amount)) : null, tags: p.tags || [] }); };
  return (
    <div className="lib-overlay" onMouseDown={onClose} style={{ zIndex: 210 }}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? 'Edit preset' : 'New preset'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><X d={IX.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Preset name</label>
            <input autoFocus value={p.name} placeholder="e.g. Morning coffee" onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Type</label>
            <div className="track-seg">
              <button className={p.type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}><X d={IX.exp} />Expense</button>
              <button className={p.type === 'income' ? 'on' : ''} onClick={() => setType('income')}><X d={IX.inc} />Income</button>
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input value={p.merchant} placeholder="e.g. Starbucks" onChange={(e) => set('merchant', e.target.value)} />
          </div>
          <div className="field">
            <div className="amt-toggle">
              <label style={{ margin: 0 }}>Include a fixed amount</label>
              <button className={`switch${hasAmt ? ' on' : ''}`} role="switch" aria-checked={hasAmt} onClick={() => setHasAmt(!hasAmt)}><i /></button>
            </div>
            {hasAmt
              ? <input type="number" min="0" value={p.amount || ''} placeholder={`Amount (${window.BAL.sym()})`} onChange={(e) => set('amount', e.target.value)} />
              : <div className="form-hint" style={{ color: 'var(--ink-3)', marginTop: 2 }}>You'll be asked for the amount each time you apply this preset.</div>}
          </div>
          <TxnFields f={p} set={set} setCat={setCat} toggleTag={toggleTag} accts={accts} tags={tags} catOpts={catOpts} subOpts={subOpts} />
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!valid}>{initial.id ? 'Save preset' : 'Create preset'}</button>
        </div>
      </div>
    </div>
  );
}

function newPreset(accts) {
  return { name: '', type: 'expense', merchant: '', category: firstCat('expense'), subcategory: '', mode: 'UPI', account: accts[0] ? accts[0].id : '', tags: [], amount: null };
}
function presetFromTxn(t) {
  return { name: t.merchant || '', type: t.type === 'income' ? 'income' : 'expense', merchant: t.merchant || '', category: t.category || firstCat('expense'), subcategory: t.subcategory || '', mode: t.mode || 'UPI', account: t.account || '', tags: [...(t.tags || [])], amount: t.amount != null ? t.amount : null };
}

function Modal({ open, onClose }) {
  const accts = window.BAL.loadAccounts();
  const tags = window.BAL.loadTags();
  const editing = open.txn || null;
  const initTab = editing ? (editing.type === 'transfer' ? 'transfer' : editing.type) : (open.tab || 'expense');
  const [tab, setTab] = useState(open.presetFrom ? 'preset' : initTab);
  const [f, setF] = useState(editing ? { ...blankFor(initTab, accts), ...editing } : blankFor(initTab, accts));
  const [presets, setPresets] = useState(window.BAL.loadPresets());
  const [presetEdit, setPresetEdit] = useState(() => open.presetFrom ? presetFromTxn(open.presetFrom) : null);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const switchTab = (t) => {
    setTab(t);
    if (t === 'preset') return;
    setF((p) => { const base = blankFor(t, accts); return { ...base, amount: p.amount || '', date: p.date || today(), merchant: p.merchant || '' }; });
  };
  const setType = (v) => setF((p) => ({ ...p, type: v, category: firstCat(v), subcategory: '' }));
  const setCat = (v) => setF((p) => ({ ...p, category: v, subcategory: '' }));
  const toggleTag = (id) => setF((p) => { const cur = p.tags || []; return { ...p, tags: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }; });

  const catOpts = tab !== 'transfer' && tab !== 'preset' ? window.BAL.categoriesByType(f.type) : [];
  const subOpts = (catOpts.find((c) => c.name === f.category) || {}).subs || [];

  const valid = tab === 'transfer'
    ? (f.amount && f.fromAccount && f.toAccount && f.fromAccount !== f.toAccount)
    : (f.merchant && f.merchant.trim() && f.amount);

  const save = () => {
    if (tab === 'preset' || !valid) return;
    let rec;
    if (tab === 'transfer') {
      const acName = (id) => (accts.find((a) => a.id === id) || {}).name || '';
      rec = { id: editing ? editing.id : window.BAL.newId(), type: 'transfer', date: f.date, amount: Math.abs(Number(f.amount)), fromAccount: f.fromAccount, toAccount: f.toAccount, account: f.fromAccount, category: 'Transfer', mode: 'Transfer', merchant: f.merchant.trim() || `${acName(f.fromAccount)} → ${acName(f.toAccount)}`, tags: [] };
    } else {
      rec = { ...f, id: editing ? editing.id : window.BAL.newId(), amount: Math.abs(Number(f.amount)), merchant: f.merchant.trim(), tags: f.tags || [] };
    }
    const all = window.BAL.loadTxns();
    window.BAL.saveTxns(editing ? all.map((x) => x.id === rec.id ? rec : x) : [rec, ...all]);
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
    onClose();
  };

  const persistPresets = (list) => { setPresets(list); window.BAL.savePresets(list); };
  const savePreset = (pr) => { persistPresets(pr.id ? presets.map((x) => x.id === pr.id ? pr : x) : [...presets, { ...pr, id: window.BAL.newId() }]); setPresetEdit(null); };
  const delPreset = (id) => persistPresets(presets.filter((x) => x.id !== id));
  const applyPreset = (pr) => {
    const base = blankFor(pr.type, accts);
    setTab(pr.type);
    setF({ ...base, type: pr.type, merchant: pr.merchant || '', category: pr.category || firstCat(pr.type), subcategory: pr.subcategory || '', mode: pr.mode || 'UPI', account: pr.account || base.account, tags: [...(pr.tags || [])], amount: (pr.amount != null && pr.amount !== '') ? pr.amount : '', date: today() });
  };

  const TABS = [['expense', 'Expense', IX.exp], ['income', 'Income', IX.inc], ['transfer', 'Transfer', IX.transfer], ['preset', 'Preset', IX.preset]];
  const tabLocked = (k) => !!editing && (k === 'preset' || (k === 'transfer') !== (tab === 'transfer'));

  return (
    <>
      <div className="lib-overlay" onMouseDown={onClose}>
        <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{editing ? 'Edit transaction' : 'New transaction'}</h3>
            <button className="lib-x" onClick={onClose} aria-label="Close"><X d={IX.x} /></button>
          </div>

          <div className="txntabs">
            {TABS.map(([k, label, ico]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => switchTab(k)} disabled={tabLocked(k)}><X d={ico} />{label}</button>
            ))}
          </div>

          {tab === 'preset' ? (
            <>
              <div className="modal-body">
                {presets.length === 0
                  ? <div className="preset-empty">No presets yet. Create one to add repetitive transactions in a tap.</div>
                  : (
                    <div className="preset-list">
                      {presets.map((pr) => (
                        <div className="preset-row" key={pr.id}>
                          <span className="pic2"><X d={pr.type === 'income' ? IX.inc : IX.exp} /></span>
                          <div className="pmid">
                            <b>{pr.name}</b>
                            <span>{pr.amount != null && pr.amount !== '' ? money(pr.amount) : 'Ask amount'} · {pr.category}{pr.subcategory ? ' › ' + pr.subcategory : ''}</span>
                          </div>
                          <div className="pacts">
                            <button className="preset-apply" onClick={() => applyPreset(pr)}><X d={IX.apply} fill />Apply</button>
                            <button className="icon-mini" title="Edit" aria-label="Edit preset" onClick={() => setPresetEdit(pr)}><X d={IX.edit} /></button>
                            <button className="icon-mini danger" title="Delete" aria-label="Delete preset" onClick={() => delPreset(pr.id)}><X d={IX.trash} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                <button className="preset-create" onClick={() => setPresetEdit(newPreset(accts))}><X d={IX.plus} />Create preset</button>
              </div>
            </>
          ) : tab === 'transfer' ? (
            <div className="modal-body">
              <div className="field"><label>Amount ({window.BAL.sym()})</label><input type="number" min="0" autoFocus value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
              <div className="xfer-row">
                <div className="field"><label>From</label><select value={f.fromAccount} onChange={(e) => set('fromAccount', e.target.value)}>{accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div className="xfer-arrow"><X d={IX.arrow} /></div>
                <div className="field"><label>To</label><select value={f.toAccount} onChange={(e) => set('toAccount', e.target.value)}>{accts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              </div>
              {f.fromAccount === f.toAccount && <div className="form-hint">Choose two different accounts.</div>}
              <div className="field"><label>Note <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label><input value={f.merchant} placeholder="e.g. Move savings" onChange={(e) => set('merchant', e.target.value)} /></div>
              <div className="field"><label>Date</label><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
            </div>
          ) : (
            <div className="modal-body">
              <div className="field"><label>Description</label><input autoFocus value={f.merchant} placeholder="e.g. Amazon" onChange={(e) => set('merchant', e.target.value)} /></div>
              <div className="field"><label>Amount ({window.BAL.sym()})</label><input type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
              <TxnFields f={f} set={set} setCat={setCat} toggleTag={toggleTag} accts={accts} tags={tags} catOpts={catOpts} subOpts={subOpts} />
              <div className="field"><label>Date</label><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
              <div className="field">
                <label>Receipt <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label>
                {f.receiptUploadId ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span>📎 Receipt attached</span>
                    <button type="button" className="btn-ghost" onClick={() => set('receiptUploadId', null)}>Remove</button>
                  </div>
                ) : (
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    try { const { id } = await apiUpload('/uploads', file); set('receiptUploadId', id); }
                    catch (err) { window.alert(err?.message || 'Upload failed'); }
                  }} />
                )}
              </div>
            </div>
          )}

          {tab !== 'preset' && (
            <div className="modal-foot">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!valid}>{editing ? 'Save changes' : tab === 'transfer' ? 'Transfer' : 'Add transaction'}</button>
            </div>
          )}
        </div>
      </div>

      {presetEdit && <PresetEditor initial={presetEdit} accts={accts} tags={tags} onSave={savePreset} onClose={() => setPresetEdit(null)} />}
    </>
  );
}

export default function AddTxn() {
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const h = (e) => setOpen(e.detail || { tab: 'expense' });
    window.addEventListener('balance:add-txn', h);
    return () => window.removeEventListener('balance:add-txn', h);
  }, []);
  if (!open) return null;
  const key = open.txn ? open.txn.id : open.presetFrom ? 'preset-' + (open.presetFrom.id || Date.now()) : 'new-' + (open.tab || 'expense');
  return <Modal key={key} open={open} onClose={() => setOpen(null)} />;
}
