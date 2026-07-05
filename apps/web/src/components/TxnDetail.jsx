/* Transaction detail modal — opens on `balance:txn-detail` event ({ txn }).
   Shows all fields for a transaction; exposes Edit, Duplicate, Preset, Delete. */
import React, { useState, useEffect } from 'react';
import { apiObjectUrl } from '../lib/api.js';
import {
  X as XIcon, PencilSimple, Copy, BookmarkSimple, Trash,
  ArrowUpRight, ArrowDownLeft, ArrowsLeftRight,
} from '@phosphor-icons/react';

const I = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const ink  = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

function DetailModal({ txn, onClose }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);

  const accts    = window.BAL.loadAccounts();
  const allTags  = window.BAL.loadTags();
  const catColor = (n) => window.BAL.catColor(n);
  const acctName = (id) => (accts.find((a) => a.id === id) || {}).name || '-';
  const tagObj   = (id) => allTags.find((t) => t.id === id);

  const isTransfer = txn.type === 'transfer';
  const TypeIco    = isTransfer ? ArrowsLeftRight : txn.type === 'income' ? ArrowDownLeft : ArrowUpRight;
  const sign       = txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : '';
  const amtColor   = txn.type === 'income' ? '#15803d' : txn.type === 'expense' ? 'var(--ink)' : 'var(--ink-3)';
  const badgeBg    = txn.type === 'income' ? tint('#15803d') : txn.type === 'expense' ? tint('#c02626') : 'var(--border-soft)';
  const badgeColor = txn.type === 'income' ? '#15803d' : txn.type === 'expense' ? '#c02626' : 'var(--ink-3)';
  const hex        = catColor(txn.category || '');

  useEffect(() => {
    if (!txn.receiptUploadId) return;
    apiObjectUrl(`/uploads/${txn.receiptUploadId}`).then(setReceiptUrl).catch(() => {});
  }, [txn.receiptUploadId]);

  const openEdit = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { txn } }));
  };

  const onDup = () => {
    const all = window.BAL.loadTxns();
    const i   = all.findIndex((x) => x.id === txn.id);
    const n   = [...all];
    n.splice(i < 0 ? 0 : i + 1, 0, { ...txn, id: window.BAL.newId() });
    window.BAL.saveTxns(n);
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
    onClose();
  };

  const onPreset = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab: 'preset', presetFrom: txn } }));
  };

  const onDel = () => {
    window.BAL.saveTxns(window.BAL.loadTxns().filter((x) => x.id !== txn.id));
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
    onClose();
  };

  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal txnd-modal" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-head">
          <div className="txnd-title">
            <div className="tx-av" style={{ background: tint(hex), color: ink(hex) }}>
              {isTransfer
                ? <ArrowsLeftRight weight="bold" size={16} />
                : (txn.merchant || '?').replace(/^\W+/, '').charAt(0).toUpperCase()}
            </div>
            <span>{txn.merchant || (isTransfer ? `${acctName(txn.fromAccount)} to ${acctName(txn.toAccount)}` : 'Transaction')}</span>
          </div>
          <button className="lib-x" onClick={onClose} aria-label="Close"><I d={XIcon} /></button>
        </div>

        {/* Amount + type */}
        <div className="txnd-hero">
          <span className="txnd-amount" style={{ color: amtColor }}>
            {sign}{window.BAL.fmt(txn.amount)}
          </span>
          <span className="txnd-badge" style={{ background: badgeBg, color: badgeColor }}>
            <I d={TypeIco} />
            {txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
          </span>
        </div>

        {/* Detail rows */}
        <div className="modal-body txnd-body">
          <div className="txnd-row">
            <span className="txnd-label">Date</span>
            <span>{window.BAL.fmtDate(txn.date)}</span>
          </div>

          {isTransfer ? (
            <>
              <div className="txnd-row">
                <span className="txnd-label">From</span>
                <span>{acctName(txn.fromAccount)}</span>
              </div>
              <div className="txnd-row">
                <span className="txnd-label">To</span>
                <span>{acctName(txn.toAccount)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="txnd-row">
                <span className="txnd-label">Category</span>
                <span className="cat-pill txnd-cat">
                  <i style={{ background: catColor(txn.category) }} />
                  {txn.category}{txn.subcategory ? ` › ${txn.subcategory}` : ''}
                </span>
              </div>
              <div className="txnd-row">
                <span className="txnd-label">Account</span>
                <span>{acctName(txn.account)}</span>
              </div>
              {txn.tags && txn.tags.length > 0 && (
                <div className="txnd-row txnd-tags-row">
                  <span className="txnd-label">Tags</span>
                  <div className="txnd-tags">
                    {txn.tags.map((id) => {
                      const tg = tagObj(id);
                      return tg
                        ? <span key={id} className="tpill" style={{ background: tint(tg.color), color: ink(tg.color) }}><i style={{ background: tg.color }} />{tg.name}</span>
                        : null;
                    })}
                  </div>
                </div>
              )}
              {receiptUrl && (
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="txnd-img-link">
                  <img src={receiptUrl} alt="Attached image" className="txnd-img-preview" />
                  <span className="txnd-img-caption">Tap to view full size</span>
                </a>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="txnd-foot">
          <button className="btn-ghost txnd-btn" onClick={openEdit}><I d={PencilSimple} />Edit</button>
          <button className="btn-ghost txnd-btn" onClick={onDup}><I d={Copy} />Duplicate</button>
          {!isTransfer && (
            <button className="btn-ghost txnd-btn" onClick={onPreset}><I d={BookmarkSimple} />Preset</button>
          )}
          {confirmDel ? (
            <div className="txnd-confirm">
              <span>Delete?</span>
              <button className="txnd-del-yes txnd-btn" onClick={onDel}>Yes</button>
              <button className="btn-ghost txnd-btn" onClick={() => setConfirmDel(false)}>No</button>
            </div>
          ) : (
            <button className="btn-ghost txnd-btn txnd-del-btn" onClick={() => setConfirmDel(true)}>
              <I d={Trash} />Delete
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default function TxnDetail() {
  const [txn, setTxn] = useState(null);
  useEffect(() => {
    const h = (e) => setTxn(e.detail?.txn || null);
    window.addEventListener('balance:txn-detail', h);
    return () => window.removeEventListener('balance:txn-detail', h);
  }, []);
  if (!txn) return null;
  return <DetailModal key={txn.id} txn={txn} onClose={() => setTxn(null)} />;
}
