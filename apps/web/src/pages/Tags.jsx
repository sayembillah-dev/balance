/* Balance — Tags page.
   Tags are colored labels attached to transactions. Create / edit / delete;
   open a tag to see its transactions + totals. */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Select from '../components/Select.jsx';

const GIco = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const GI = {
  plus:   ['M12 5v14', 'M5 12h14'],
  back:   ['M15 6l-6 6 6 6'],
  x:      ['M6 6l12 12', 'M18 6 6 18'],
  kebab:  ['M12 5.5h.01', 'M12 12h.01', 'M12 18.5h.01'],
  edit:   ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  trash:  ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm21 21-4.3-4.3'],
  arrow:  ['M12 5v14', 'm6 11 6 6 6-6'],
  prev:   ['M15 6l-6 6 6 6'], next: ['M9 6l6 6-6 6'],
  in:     ['M7 7v10h10', 'M7 17 17 7'],
  out:    ['M17 17V7H7', 'M17 7 7 17'],
  list:   ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'],
};
const COLORS = ['#2f6fe0', '#7c4dd8', '#138a72', '#e0892f', '#d6457a', '#0e7490', '#c0606a', '#16a34a', '#b45309', '#9333ea', '#0d9488', '#64748b'];

const fmtDate = (iso) => window.BAL.fmtDate(iso);
const grp = (n) => Math.abs(n).toLocaleString('en-IN');
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;
const catColor = (n) => window.BAL.catColor(n);
const loadTxns = () => window.BAL.loadTxns();
// Live (caches fill after login/hydrate, so don't capture at module load).
const CAT_LIST = () => window.BAL.catNames();

const tagStats = (id, txns) => {
  let income = 0, spent = 0, count = 0;
  for (const t of txns) if ((t.tags || []).includes(id)) { count++; if (t.type === 'income') income += t.amount; else spent += t.amount; }
  return { income, spent, count };
};

function TagModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => { if (!f.name.trim()) return; onSave({ ...f, name: f.name.trim() }); };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? 'Edit tag' : 'New tag'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><GIco d={GI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Tag name</label>
            <input autoFocus value={f.name} placeholder="e.g. Reimbursable" onChange={(e) => set('name', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </div>
          <div className="field">
            <label>Colour</label>
            <div className="swatches">
              {COLORS.map((c) => <button key={c} type="button" className={`sw${f.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
            </div>
          </div>
          <div className="field">
            <label>Preview</label>
            <div><span className="tpill" style={{ background: tint(f.color), color: inkc(f.color) }}><i style={{ background: f.color }} />{f.name.trim() || 'Tag name'}</span></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{initial.id ? 'Save changes' : 'Add tag'}</button>
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
    <div className="menu" ref={ref}>
      <button onClick={onEdit}><GIco d={GI.edit} />Edit tag</button>
      <div className="sep" />
      <button className="danger" onClick={onDel}><GIco d={GI.trash} />Delete tag</button>
    </div>
  );
}

const PAGE = 8;
function TxnList({ txns }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [cards, setCards] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const m = () => setCards(el.clientWidth < 640);
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = txns.filter((t) => (type === 'all' || t.type === type) && (cat === 'all' || t.category === cat)
      && (!q || t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)));
    r = [...r].sort((a, b) => { let d = sort.key === 'amount' ? a.amount - b.amount : a.date.localeCompare(b.date); if (!d) d = a.id - b.id; return sort.dir === 'asc' ? d : -d; });
    return r;
  }, [txns, query, type, cat, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [query, type, cat, sort]);
  const slice = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const from = filtered.length ? (cur - 1) * PAGE + 1 : 0;
  const to = Math.min(cur * PAGE, filtered.length);
  const toggle = (k) => setSort((s) => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' });
  const Head = ({ k, label, right }) => (
    <th className={`sortable${sort.key === k ? ' sorted' : ''}${right ? ' col-r' : ''}`} onClick={() => toggle(k)}>
      <span className="th-in" style={right ? { justifyContent: 'flex-end' } : null}>{label}
        <span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : 'none' }}><GIco d={GI.arrow} /></span></span>
    </th>
  );
  const Av = ({ t }) => { const h = catColor(t.category); return <div className="tx-av" style={{ background: tint(h), color: inkc(h) }}>{t.merchant.replace(/^\W+/, '').charAt(0).toUpperCase()}</div>; };
  return (
    <div ref={ref}>
      <div className="txn-toolbar" style={{ marginBottom: 14 }}>
        <div className="txn-search"><GIco d={GI.search} /><input value={query} placeholder="Search tagged transactions…" onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="txn-seg">{[['all', 'All'], ['expense', 'Expense'], ['income', 'Income']].map(([v, l]) => <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>{l}</button>)}</div>
        <Select value={cat} onChange={(v) => setCat(v)} ariaLabel="Filter by category"
          options={[{ value: 'all', label: 'All categories' }, ...CAT_LIST().map((c) => ({ value: c, label: c }))]} />
      </div>
      {slice.length === 0 ? (
        <div className="txn-card"><div className="txn-empty"><b>No transactions</b><span>Nothing matches your filters here.</span></div></div>
      ) : cards ? (
        <div className="txn-cards">
          {slice.map((t) => (
            <div className="txn-cardrow" key={t.id}>
              <Av t={t} />
              <div className="tx-mid"><b>{t.merchant}</b><div className="tx-sub"><i style={{ background: catColor(t.category) }} />{t.category}</div></div>
              <div className="tx-right"><span className={`tx-amt ${t.type}`}>{t.type === 'income' ? '+' : '−'}{window.BAL.fmt(t.amount)}</span><span className="when">{fmtDate(t.date)}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="txn-card"><div className="txn-tablewrap">
          <table className="txn-table">
            <thead><tr><th>Description</th><th>Category</th><Head k="date" label="Date" /><Head k="amount" label="Amount" right /></tr></thead>
            <tbody>
              {slice.map((t) => (
                <tr key={t.id}>
                  <td><div className="tx-merchant"><Av t={t} /><div className="tx-name"><b>{t.merchant}</b></div></div></td>
                  <td><span className="cat-pill"><i style={{ background: catColor(t.category) }} />{t.category}</span></td>
                  <td><span className="tx-date">{fmtDate(t.date)}</span></td>
                  <td className={`tx-amt ${t.type}`}>{t.type === 'income' ? '+' : '−'}{window.BAL.fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      <div className="txn-foot" style={{ marginTop: 16 }}>
        <span className="info">Showing {from}–{to} of {filtered.length}</span>
        <Pager page={cur} pages={pages} onGo={setPage} />
      </div>
    </div>
  );
}

function Pager({ page, pages, onGo }) {
  const nums = useMemo(() => {
    const out = []; if (pages <= 7) { for (let i = 1; i <= pages; i++) out.push(i); }
    else { out.push(1); if (page > 3) out.push('…'); for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) out.push(i); if (page < pages - 2) out.push('…'); out.push(pages); }
    return out;
  }, [page, pages]);
  return (
    <div className="pager">
      <button onClick={() => onGo(page - 1)} disabled={page <= 1} aria-label="Previous"><GIco d={GI.prev} /></button>
      {nums.map((n, i) => n === '…' ? <span className="gap" key={`g${i}`}>…</span> : <button key={n} className={n === page ? 'on' : ''} onClick={() => onGo(n)}>{n}</button>)}
      <button onClick={() => onGo(page + 1)} disabled={page >= pages} aria-label="Next"><GIco d={GI.next} /></button>
    </div>
  );
}

export default function Tags() {
  const [tags, setTags] = useState(window.BAL.loadTags());
  const [txns, setTxns] = useState(loadTxns());
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menuId, setMenuId] = useState(null);

  useEffect(() => { window.BAL.saveTags(tags); }, [tags]);
  useEffect(() => {
    const h = (e) => { if (!e.detail || e.detail === 'tags') setTxns(loadTxns()); };
    window.addEventListener('balance:page', h);
    return () => window.removeEventListener('balance:page', h);
  }, []);

  const onSave = useCallback((t) => {
    setTags((list) => t.id ? list.map((x) => x.id === t.id ? t : x) : [...list, { ...t, id: window.BAL.newId() }]);
    setEditing(null);
  }, []);
  const onDel = useCallback((id) => { setTags((list) => list.filter((x) => x.id !== id)); setMenuId(null); setSelId(null); }, []);

  const blank = { name: '', color: COLORS[0] };
  const sel = tags.find((t) => t.id === selId);

  if (sel) {
    const s = tagStats(sel.id, txns);
    const list = txns.filter((t) => (t.tags || []).includes(sel.id));
    return (
      <div className="tag">
        <button className="detail-back" onClick={() => setSelId(null)}><GIco d={GI.back} />All tags</button>
        <div className="detail-hero">
          <div className="tag-hash" style={{ background: sel.color, width: 52, height: 52, fontSize: 24, borderRadius: 14 }}>#</div>
          <div className="hx"><h2>{sel.name}</h2><p>{s.count} tagged transaction{s.count === 1 ? '' : 's'}</p></div>
          <div className="detail-acts">
            <button className="btn-ghost" onClick={() => setEditing(sel)}><GIco d={GI.edit} />Edit</button>
            <button className="btn-ghost" onClick={() => onDel(sel.id)}><GIco d={GI.trash} />Delete</button>
          </div>
        </div>
        <div className="acct-sum">
          <div className="tile"><div className="tlab"><span className="tic"><GIco d={GI.list} /></span>Transactions</div><b>{s.count}</b></div>
          <div className="tile"><div className="tlab"><span className="tic"><GIco d={GI.out} /></span>Spent</div><b className="out">{window.BAL.fmt(s.spent)}</b></div>
          <div className="tile"><div className="tlab"><span className="tic"><GIco d={GI.in} /></span>Income</div><b className="in">{window.BAL.fmt(s.income)}</b></div>
        </div>
        <TxnList txns={list} />
        {editing && <TagModal key={editing.id || 'new'} initial={editing} onSave={onSave} onClose={() => setEditing(null)} />}
      </div>
    );
  }

  return (
    <div className="tag">
      <div className="txn-head">
        <div><h2>Tags</h2><p>Label transactions and track them across categories & accounts</p></div>
        <button className="btn-primary" onClick={() => setEditing(blank)}><GIco d={GI.plus} />New tag</button>
      </div>

      <div className="tag-grid">
        {tags.map((tg) => {
          const s = tagStats(tg.id, txns);
          return (
            <div className="tag-card" key={tg.id} onClick={() => setSelId(tg.id)}>
              <button className={`kebab${menuId === tg.id ? ' open' : ''}`} aria-label="Tag actions" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === tg.id ? null : tg.id); }}><GIco d={GI.kebab} fill /></button>
              {menuId === tg.id && (
                <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
                  <RowMenu onEdit={() => { setEditing(tg); setMenuId(null); }} onDel={() => onDel(tg.id)} onClose={() => setMenuId(null)} />
                </div>
              )}
              <div className="tag-top">
                <span className="tag-hash" style={{ background: tg.color }}>#</span>
                <b>{tg.name}</b>
              </div>
              <div className="tag-foot">
                <div className="m"><span>Transactions</span><b>{s.count}</b></div>
                <div className="m"><span>Spent</span><b>{window.BAL.fmt(s.spent)}</b></div>
              </div>
            </div>
          );
        })}
        <button className="acct-add" onClick={() => setEditing(blank)}>
          <span className="pl"><GIco d={GI.plus} /></span>
          <b>Add tag</b>
        </button>
      </div>

      {editing && <TagModal key={editing.id || 'new'} initial={editing} onSave={onSave} onClose={() => setEditing(null)} />}
    </div>
  );
}
