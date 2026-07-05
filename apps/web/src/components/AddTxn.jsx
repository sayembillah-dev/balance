/* Balance — global Add/Edit transaction modal + Presets.
   Opens on `balance:add-txn` (detail: { tab?, txn?: existing, presetFrom?: txn }).
   Saves transactions via window.BAL.saveTxns; presets via window.BAL.savePresets. */
import React, { useState, useEffect } from 'react';
import { apiUpload, apiObjectUrl } from '../lib/api.js';
import Select from './Select.jsx';
import DatePicker from './DatePicker.jsx';
import AmountInput from './AmountInput.jsx';
import { X as XIcon, ArrowUpRight, ArrowDownLeft, ArrowsLeftRight, Cards, ArrowRight, Plus, PencilSimple, Trash, Play, Image as ImageIcon } from '@phosphor-icons/react';

const X = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const IX = {
  x: XIcon, exp: ArrowUpRight, inc: ArrowDownLeft, transfer: ArrowsLeftRight, preset: Cards,
  arrow: ArrowRight, plus: Plus, edit: PencilSimple, trash: Trash, apply: Play,
};
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;
const today = () => window.BAL.today();
const firstCat = (type) => (window.BAL.categoriesByType(type)[0] || {}).name || '';
const money = (n) => window.BAL.fmt(n);

function blankFor(tab, accts) {
  if (tab === 'transfer') return { type: 'transfer', amount: '', fromAccount: accts[0] ? accts[0].id : '', toAccount: accts[1] ? accts[1].id : (accts[0] ? accts[0].id : ''), merchant: '', date: today() };
  const type = tab === 'income' ? 'income' : 'expense';
  return { type, merchant: '', amount: '', category: firstCat(type), subcategory: '', account: accts[0] ? accts[0].id : '', tags: [], date: today() };
}

function TxnFields({ f, set, setCat, toggleTag, accts, tags, catOpts, subOpts }) {
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <Select value={f.category} onChange={(v) => setCat(v)} ariaLabel="Category"
            options={catOpts.map((c) => ({ value: c.name, label: c.name }))} />
        </div>
        <div className="field">
          <label>Sub-category</label>
          <Select value={f.subcategory || ''} onChange={(v) => set('subcategory', v)} disabled={subOpts.length === 0} ariaLabel="Sub-category"
            options={[{ value: '', label: subOpts.length === 0 ? 'None' : '— none —' }, ...subOpts.map((s) => ({ value: s, label: s }))]} />
        </div>
      </div>
      <div className="field">
        <label>Account</label>
        <Select value={f.account} onChange={(v) => set('account', v)} ariaLabel="Account"
          options={accts.map((a) => ({ value: a.id, label: a.name }))} />
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
  const [saving, setSaving] = useState(false);
  const save = () => { if (!valid) return; setSaving(true); onSave({ ...p, name: p.name.trim(), merchant: p.merchant.trim(), amount: hasAmt ? Math.abs(Number(p.amount)) : null, tags: p.tags || [] }); };
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
              ? <AmountInput value={p.amount || ''} placeholder={`Amount (${window.BAL.sym()})`} onChange={(e) => set('amount', e.target.value)} />
              : <div className="form-hint" style={{ color: 'var(--ink-3)', marginTop: 2 }}>You'll be asked for the amount each time you apply this preset.</div>}
          </div>
          <TxnFields f={p} set={set} setCat={setCat} toggleTag={toggleTag} accts={accts} tags={tags} catOpts={catOpts} subOpts={subOpts} />
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={!valid || saving}>{saving ? <><span className="btn-spin" />{initial.id ? 'Saving…' : 'Creating…'}</> : initial.id ? 'Save preset' : 'Create preset'}</button>
        </div>
      </div>
    </div>
  );
}

function newPreset(accts) {
  return { name: '', type: 'expense', merchant: '', category: firstCat('expense'), subcategory: '', account: accts[0] ? accts[0].id : '', tags: [], amount: null };
}
function presetFromTxn(t) {
  return { name: t.merchant || '', type: t.type === 'income' ? 'income' : 'expense', merchant: t.merchant || '', category: t.category || firstCat('expense'), subcategory: t.subcategory || '', account: t.account || '', tags: [...(t.tags || [])], amount: t.amount != null ? t.amount : null };
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
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing?.receiptUploadId) {
      apiObjectUrl(`/uploads/${editing.receiptUploadId}`).then(setReceiptPreviewUrl).catch(() => {});
    }
  }, []);

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
    setSaving(true);
    let rec;
    if (tab === 'transfer') {
      const acName = (id) => (accts.find((a) => a.id === id) || {}).name || '';
      rec = { id: editing ? editing.id : window.BAL.newId(), type: 'transfer', date: f.date, amount: Math.abs(Number(f.amount)), fromAccount: f.fromAccount, toAccount: f.toAccount, account: f.fromAccount, category: 'Transfer', merchant: f.merchant.trim() || `${acName(f.fromAccount)} → ${acName(f.toAccount)}`, tags: [] };
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
    setF({ ...base, type: pr.type, merchant: pr.merchant || '', category: pr.category || firstCat(pr.type), subcategory: pr.subcategory || '', account: pr.account || base.account, tags: [...(pr.tags || [])], amount: (pr.amount != null && pr.amount !== '') ? pr.amount : '', date: today() });
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
              <div className="field"><label>Amount ({window.BAL.sym()})</label><AmountInput autoFocus value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
              <div className="xfer-row">
                <div className="field"><label>From</label><Select value={f.fromAccount} onChange={(v) => set('fromAccount', v)} ariaLabel="From account" options={accts.map((a) => ({ value: a.id, label: a.name }))} /></div>
                <div className="xfer-arrow"><X d={IX.arrow} /></div>
                <div className="field"><label>To</label><Select value={f.toAccount} onChange={(v) => set('toAccount', v)} ariaLabel="To account" options={accts.map((a) => ({ value: a.id, label: a.name }))} /></div>
              </div>
              {f.fromAccount === f.toAccount && <div className="form-hint">Choose two different accounts.</div>}
              <div className="field"><label>Note <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label><input value={f.merchant} placeholder="e.g. Move savings" onChange={(e) => set('merchant', e.target.value)} /></div>
              <div className="field"><label>Date</label><DatePicker value={f.date} onChange={(v) => set('date', v)} /></div>
            </div>
          ) : (
            <div className="modal-body">
              <div className="field"><label>Description</label><input autoFocus value={f.merchant} placeholder="e.g. Amazon" onChange={(e) => set('merchant', e.target.value)} /></div>
              <div className="field"><label>Amount ({window.BAL.sym()})</label><AmountInput value={f.amount} onChange={(e) => set('amount', e.target.value)} /></div>
              <TxnFields f={f} set={set} setCat={setCat} toggleTag={toggleTag} accts={accts} tags={tags} catOpts={catOpts} subOpts={subOpts} />
              <div className="field"><label>Date</label><DatePicker value={f.date} onChange={(v) => set('date', v)} /></div>
              <div className="field">
                <label>Upload Image <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(optional)</span></label>
                {receiptPreviewUrl ? (
                  <div className="img-preview-wrap">
                    <a href={receiptPreviewUrl} target="_blank" rel="noreferrer">
                      <img src={receiptPreviewUrl} className="img-preview-thumb" alt="Attached image" />
                    </a>
                    <button type="button" className="img-preview-remove" aria-label="Remove image"
                      onClick={() => { URL.revokeObjectURL(receiptPreviewUrl); setReceiptPreviewUrl(null); set('receiptUploadId', null); }}>
                      ×
                    </button>
                  </div>
                ) : (
                  <label className={`img-upload-zone${uploading ? ' uploading' : ''}`}>
                    <ImageIcon size={26} />
                    <span>{uploading ? 'Uploading…' : 'Click to upload'}</span>
                    <small>PNG, JPG or WebP</small>
                    <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const localUrl = URL.createObjectURL(file);
                        setReceiptPreviewUrl(localUrl);
                        setUploading(true);
                        try {
                          const { id } = await apiUpload('/uploads', file);
                          set('receiptUploadId', id);
                        } catch (err) {
                          URL.revokeObjectURL(localUrl);
                          setReceiptPreviewUrl(null);
                          window.alert(err?.message || 'Upload failed');
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {tab !== 'preset' && (
            <div className="modal-foot">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!valid || saving}>{saving ? <><span className="btn-spin" />{editing ? 'Saving…' : tab === 'transfer' ? 'Transferring…' : 'Adding…'}</> : editing ? 'Save changes' : tab === 'transfer' ? 'Transfer' : 'Add transaction'}</button>
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
