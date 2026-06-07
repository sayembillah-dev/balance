/* Balance — Transactions page.
   Search, filter, sort, paginate; edit/duplicate/delete.
   Responsive: table on wide containers, card list on narrow (mobile/tablet). */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Select from '../components/Select.jsx';
import { MagnifyingGlass, Plus, X, ArrowDown, PencilSimple, Copy, BookmarkSimple, Trash, CaretLeft, CaretRight, FunnelSimple } from '@phosphor-icons/react';
import ThreeDots from '../components/ThreeDots.jsx';

const TIco = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const TI = {
  search: MagnifyingGlass, plus: Plus, x: X, arrow: ArrowDown, kebab: ThreeDots,
  edit: PencilSimple, copy: Copy, bookmark: BookmarkSimple, trash: Trash,
  prev: CaretLeft, next: CaretRight, filter: FunnelSimple,
};

const catColor = (n) => window.BAL.catColor(n);
// Live lookup (not captured at module load — caches fill after login/hydrate).
const ACCT_NAME = (id) => (window.BAL.loadAccounts().find((a) => a.id === id) || {}).name || '—';
const tagById = (id) => window.BAL.loadTags().find((t) => t.id === id);

const fmtDate = (iso) => window.BAL.fmtDate(iso);
const fmtAmt = (n) => n.toLocaleString('en-IN');
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const ink = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

const PAGE_SIZE = 9;

const Avatar = ({ name, category }) => {
  const hex = catColor(category);
  return <div className="tx-av" style={{ background: tint(hex), color: ink(hex) }}>{name.replace(/^\W+/, '').charAt(0).toUpperCase()}</div>;
};

function RowMenu({ onEdit, onDup, onPreset, onDel, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('mousedown', h);
    window.addEventListener('keydown', (ev) => ev.key === 'Escape' && onClose());
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="menu" ref={ref}>
      <button onClick={onEdit}><TIco d={TI.edit} />Edit</button>
      <button onClick={onDup}><TIco d={TI.copy} />Duplicate</button>
      {onPreset && <button onClick={onPreset}><TIco d={TI.bookmark} />Save as preset</button>}
      <div className="sep" />
      <button className="danger" onClick={onDel}><TIco d={TI.trash} />Delete</button>
    </div>
  );
}

function Transactions() {
  const [txns, setTxns] = useState(() => window.BAL.loadTxns());
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState(null);
  const [cards, setCards] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const h = () => setTxns(window.BAL.loadTxns());
    window.addEventListener('balance:txn-changed', h);
    window.addEventListener('balance:page', h);
    return () => { window.removeEventListener('balance:txn-changed', h); window.removeEventListener('balance:page', h); };
  }, []);

  // Top-bar search jumps here and applies its term.
  useEffect(() => {
    const h = (e) => setQuery(e.detail || '');
    window.addEventListener('balance:search', h);
    return () => window.removeEventListener('balance:search', h);
  }, []);

  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const measure = () => { if (el.clientWidth) setCards(el.clientWidth < 680); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    window.addEventListener('balance:page', measure);
    return () => { ro.disconnect(); window.removeEventListener('balance:page', measure); };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = txns.filter((t) =>
      (type === 'all' || t.type === type) &&
      (cat === 'all' || t.category === cat) &&
      (!q || t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    );
    r = [...r].sort((a, b) => {
      let d = sort.key === 'amount' ? a.amount - b.amount : a.date.localeCompare(b.date);
      if (d === 0) d = a.id - b.id;
      return sort.dir === 'asc' ? d : -d;
    });
    return r;
  }, [txns, query, type, cat, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  useEffect(() => { if (page > pages) setPage(pages); }, [pages, page]);
  useEffect(() => { setPage(1); }, [query, type, cat, sort]);
  const slice = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (cur - 1) * PAGE_SIZE + 1;
  const to = Math.min(cur * PAGE_SIZE, filtered.length);

  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'amount' ? 'desc' : 'desc' });
  const sign = (t) => t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const openNew = () => window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab: 'expense' } }));
  const openEdit   = (t) => window.dispatchEvent(new CustomEvent('balance:add-txn',    { detail: { txn: t } }));
  const openDetail = (t) => window.dispatchEvent(new CustomEvent('balance:txn-detail', { detail: { txn: t } }));

  const onDup = useCallback((t) => {
    const all = window.BAL.loadTxns();
    const i = all.findIndex((x) => x.id === t.id);
    const n = [...all]; n.splice(i < 0 ? 0 : i + 1, 0, { ...t, id: window.BAL.newId() });
    window.BAL.saveTxns(n); setTxns(n); setMenuId(null);
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
  }, []);
  const onDel = useCallback((id) => {
    const n = window.BAL.loadTxns().filter((x) => x.id !== id);
    window.BAL.saveTxns(n); setTxns(n); setMenuId(null);
    window.dispatchEvent(new CustomEvent('balance:txn-changed'));
  }, []);

  const SortHead = ({ k, label, right }) => (
    <th className={`sortable${sort.key === k ? ' sorted' : ''}${right ? ' col-r' : ''}`} onClick={() => toggleSort(k)}>
      <span className="th-in" style={right ? { justifyContent: 'flex-end' } : null}>
        {label}
        <span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : 'none' }}><TIco d={TI.arrow} /></span>
      </span>
    </th>
  );

  const ActionMenu = ({ t }) => (
    <div className="tx-actions" onClick={(e) => e.stopPropagation()}>
      <button className={`kebab${menuId === t.id ? ' open' : ''}`} aria-label="Actions"
              onClick={(e) => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id); }}>
        <TIco d={TI.kebab} fill />
      </button>
      {menuId === t.id && (
        <RowMenu
          onEdit={() => { openEdit(t); setMenuId(null); }}
          onDup={() => onDup(t)}
          onPreset={t.type === 'transfer' ? null : () => { setMenuId(null); window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab: 'preset', presetFrom: t } })); }}
          onDel={() => onDel(t.id)}
          onClose={() => setMenuId(null)}
        />
      )}
    </div>
  );

  return (
    <div className="txn" ref={rootRef}>
      <div className="txn-head">
        <div>
          <h2>Transactions</h2>
          <p>{filtered.length} of {txns.length} transactions</p>
        </div>
        <button className="btn-primary" onClick={openNew}><TIco d={TI.plus} />New transaction</button>
      </div>

      <div className="txn-toolbar">
        <div className="txn-search">
          <TIco d={TI.search} />
          <input value={query} placeholder="Search description, category…" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="txn-seg">
          {[['all', 'All'], ['expense', 'Expense'], ['income', 'Income']].map(([v, l]) => (
            <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
        <Select value={cat} onChange={(v) => setCat(v)} ariaLabel="Filter by category"
          options={[{ value: 'all', label: 'All categories' }, ...window.BAL.catNames().map((c) => ({ value: c, label: c }))]} />
      </div>

      {slice.length === 0 ? (
        <div className="txn-card"><div className="txn-empty"><b>No transactions found</b><span>Try adjusting your search or filters.</span></div></div>
      ) : cards ? (
        <div className="txn-cards">
          {slice.map((t) => (
            <div className="txn-cardrow" key={t.id} onClick={() => openDetail(t)}>
              <Avatar name={t.merchant} category={t.category} />
              <div className="tx-mid">
                <b>{t.merchant}</b>
                <div className="tx-sub"><i style={{ background: catColor(t.category) }} />{t.category}</div>
              </div>
              <div className="tx-right">
                <span className={`tx-amt ${t.type}`}>{sign(t)}{window.BAL.fmt(t.amount)}</span>
                <span className="when">{fmtDate(t.date)}</span>
              </div>
              <ActionMenu t={t} />
            </div>
          ))}
        </div>
      ) : (
        <div className="txn-card">
          <div className="txn-tablewrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <SortHead k="date" label="Date" />
                  <SortHead k="amount" label="Amount" right />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {slice.map((t) => (
                  <tr key={t.id} onClick={() => openDetail(t)}>
                    <td>
                      <div className="tx-merchant">
                        <Avatar name={t.merchant} category={t.category} />
                        <div className="tx-name"><b>{t.merchant}</b><span>{ACCT_NAME(t.account)}</span>
                          {(t.tags && t.tags.length > 0) && (
                            <div className="tx-tags">
                              {t.tags.map((id) => { const tg = tagById(id); return tg ? <span key={id} className="tpill" style={{ background: tint(tg.color), color: ink(tg.color) }}><i style={{ background: tg.color }} />{tg.name}</span> : null; })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><span className="cat-pill"><i style={{ background: catColor(t.category) }} />{t.category}</span></td>
                    <td><span className="tx-date">{fmtDate(t.date)}</span></td>
                    <td className={`tx-amt ${t.type}`}>{sign(t)}{window.BAL.fmt(t.amount)}</td>
                    <td><ActionMenu t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="txn-foot">
        <span className="info">Showing {from}–{to} of {filtered.length}</span>
        <Pager page={cur} pages={pages} onGo={setPage} />
      </div>
    </div>
  );
}

function Pager({ page, pages, onGo }) {
  const nums = useMemo(() => {
    const out = [];
    const add = (n) => out.push(n);
    if (pages <= 7) { for (let i = 1; i <= pages; i++) add(i); }
    else {
      add(1);
      if (page > 3) add('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) add(i);
      if (page < pages - 2) add('…');
      add(pages);
    }
    return out;
  }, [page, pages]);
  return (
    <div className="pager">
      <button onClick={() => onGo(page - 1)} disabled={page <= 1} aria-label="Previous"><TIco d={TI.prev} /></button>
      {nums.map((n, i) => n === '…'
        ? <span className="gap" key={`g${i}`}>…</span>
        : <button key={n} className={n === page ? 'on' : ''} onClick={() => onGo(n)}>{n}</button>)}
      <button onClick={() => onGo(page + 1)} disabled={page >= pages} aria-label="Next"><TIco d={TI.next} /></button>
    </div>
  );
}

export default Transactions;
