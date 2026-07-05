/* SplitModal — carve a transaction into multiple categorised records.
   Opens on `balance:split-txn` event ({ txn }).
   Each carved split inherits type / date / account from the original.
   On OK: original is deleted and replaced by splits + remainder (auto-stays as original category). */
import React, { useState, useEffect } from 'react';
import Select from './Select.jsx';
import AmountInput from './AmountInput.jsx';
import { X as XIcon, Scissors, Plus, Trash } from '@phosphor-icons/react';

const I = ({ d: C }) => (C ? <C weight="regular" /> : null);
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const ink  = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

function blankForm(txn) {
  const catOpts = window.BAL.categoriesByType(txn.type);
  return { category: catOpts[0]?.name || '', subcategory: '', note: '', amount: '' };
}

function SplitModalInner({ txn, onClose }) {
  const [splits, setSplits]   = useState([]);
  const [form, setForm]       = useState(null); // null = hidden
  const [saving, setSaving]   = useState(false);

  const catOpts   = window.BAL.categoriesByType(txn.type);
  const subOpts   = form ? ((catOpts.find((c) => c.name === form.category) || {}).subs || []) : [];
  const catColor  = (n) => window.BAL.catColor(n);

  const totalSplit = splits.reduce((s, x) => s + x.amount, 0);
  const remaining  = Math.round((txn.amount - totalSplit) * 100) / 100;

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCat = (v) => setForm((f) => ({ ...f, category: v, subcategory: '' }));

  const createSplit = () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    setSplits((s) => [...s, { ...form, amount: amt }]);
    setForm(null);
  };

  const removeSplit = (idx) => setSplits((s) => s.filter((_, i) => i !== idx));

  const formValid = form && Number(form.amount) > 0 && Number(form.amount) <= remaining + 0.001;

  const commit = () => {
    if (splits.length === 0) { onClose(); return; }
    setSaving(true);

    const base = {
      type: txn.type,
      date: txn.date,
      account: txn.account,
      fromAccount: txn.fromAccount,
      toAccount: txn.toAccount,
      tags: [],
    };

    const newTxns = splits.map((s) => ({
      ...base,
      id: window.BAL.newId(),
      merchant: s.note.trim() || txn.merchant || '',
      amount: s.amount,
      category: s.category,
      subcategory: s.subcategory,
    }));

    // Remainder auto-stays as original category
    if (remaining > 0.001) {
      newTxns.push({
        ...base,
        id: window.BAL.newId(),
        merchant: txn.merchant || '',
        amount: remaining,
        category: txn.category,
        subcategory: txn.subcategory,
      });
    }

    const all      = window.BAL.loadTxns();
    const origIdx  = all.findIndex((x) => x.id === txn.id);
    const without  = all.filter((x) => x.id !== txn.id);
    const before   = origIdx >= 0 ? without.slice(0, origIdx) : without;
    const after    = origIdx >= 0 ? without.slice(origIdx) : [];
    window.BAL.saveTxns([...before, ...newTxns, ...after]);
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
    onClose();
  };

  const sign     = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : '';
  const amtColor = txn.type === 'income' ? '#15803d' : 'var(--ink)';

  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal split-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scissors size={17} />
            <h3>Split transaction</h3>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><I d={XIcon} /></button>
        </div>

        <div className="modal-body split-body">

          {/* Original record */}
          <div className="split-orig">
            <div className="split-orig-left">
              <div className="tx-av" style={{ background: tint(catColor(txn.category)), color: ink(catColor(txn.category)) }}>
                {(txn.merchant || '?').replace(/^\W+/, '').charAt(0).toUpperCase()}
              </div>
              <div className="split-orig-info">
                <span className="split-orig-merchant">{txn.merchant || 'Transaction'}</span>
                <span className="cat-pill">
                  <i style={{ background: catColor(txn.category) }} />
                  {txn.category}{txn.subcategory ? ` › ${txn.subcategory}` : ''}
                </span>
              </div>
            </div>
            <div className="split-orig-amt" style={{ color: amtColor }}>
              {sign}{window.BAL.fmt(remaining > 0 ? remaining : 0)}
            </div>
          </div>

          {/* Created splits list */}
          {splits.length > 0 && (
            <div className="split-list">
              {splits.map((s, i) => (
                <div key={i} className="split-row">
                  <div className="split-row-left">
                    <div className="tx-av split-av" style={{ background: tint(catColor(s.category)), color: ink(catColor(s.category)) }}>
                      {(s.note || s.category || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="split-row-info">
                      <span className="split-row-merchant">{s.note || s.category}</span>
                      <span className="cat-pill" style={{ fontSize: 11.5 }}>
                        <i style={{ background: catColor(s.category) }} />
                        {s.category}{s.subcategory ? ` › ${s.subcategory}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="split-row-right">
                    <span className="split-row-amt" style={{ color: amtColor }}>{sign}{window.BAL.fmt(s.amount)}</span>
                    <button className="split-remove" onClick={() => removeSplit(i)} aria-label="Remove split">
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Record form or Split trigger */}
          {form ? (
            <div className="split-form">
              <div className="split-form-head">New Record</div>
              <div className="field-row">
                <div className="field">
                  <label>Category</label>
                  <Select value={form.category} onChange={setCat} ariaLabel="Category"
                    options={catOpts.map((c) => ({ value: c.name, label: c.name }))} />
                </div>
                <div className="field">
                  <label>Sub-category</label>
                  <Select value={form.subcategory || ''} onChange={(v) => setF('subcategory', v)}
                    disabled={subOpts.length === 0} ariaLabel="Sub-category"
                    options={[{ value: '', label: subOpts.length === 0 ? 'None' : '— none —' }, ...subOpts.map((s) => ({ value: s, label: s }))]} />
                </div>
              </div>
              <div className="field">
                <label>Note / Description</label>
                <input
                  autoFocus
                  value={form.note}
                  placeholder={txn.merchant || 'e.g. Groceries'}
                  onChange={(e) => setF('note', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Amount ({window.BAL.sym()})</label>
                <AmountInput value={form.amount} onChange={(e) => setF('amount', e.target.value)} />
              </div>
              <div className="split-form-foot">
                <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                <button className="btn-primary" onClick={createSplit} disabled={!formValid}>Create</button>
              </div>
            </div>
          ) : (
            <button className="split-add-btn" onClick={() => setForm(blankForm(txn))}>
              <Plus size={15} weight="bold" /> Split
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={commit} disabled={splits.length === 0 || saving}>
            {saving ? <><span className="btn-spin" />Splitting…</> : 'OK'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function SplitModal() {
  const [txn, setTxn] = useState(null);
  useEffect(() => {
    const h = (e) => setTxn(e.detail?.txn || null);
    window.addEventListener('balance:split-txn', h);
    return () => window.removeEventListener('balance:split-txn', h);
  }, []);
  if (!txn) return null;
  return <SplitModalInner key={txn.id} txn={txn} onClose={() => setTxn(null)} />;
}
