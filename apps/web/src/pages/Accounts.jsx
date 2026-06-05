/* Balance — Accounts page.
   List/create/update/delete accounts; open an account to see its
   balance/income/spent and a searchable, sortable, filterable transaction list. */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Select from '../components/Select.jsx';
import { Bank, CreditCard, Wallet, Money, Plus, ArrowLeft, X, DotsThreeVertical, PencilSimple, Trash, MagnifyingGlass, ArrowDown, CaretLeft, CaretRight, ArrowDownLeft, ArrowUpRight, ListBullets } from '@phosphor-icons/react';

const AIco = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const AI = {
  bank: Bank, card: CreditCard, wallet: Wallet, cash: Money, plus: Plus, back: ArrowLeft,
  x: X, kebab: DotsThreeVertical, edit: PencilSimple, trash: Trash, search: MagnifyingGlass,
  arrow: ArrowDown, prev: CaretLeft, next: CaretRight, wallet2: Wallet,
  in: ArrowDownLeft, out: ArrowUpRight, list: ListBullets,
};
const TYPE_ICON = { Bank: 'bank', Card: 'card', Wallet: 'wallet', Cash: 'cash' };
const TYPES = ['Bank', 'Card', 'Wallet', 'Cash'];
const COLORS = ['#2f6fe0', '#7c4dd8', '#138a72', '#e0892f', '#d6457a', '#3aa3a3', '#c0606a', '#475569'];

const CATS_COLOR = (n) => window.BAL.catColor(n);
// Live (caches fill after login/hydrate, so don't capture at module load).
const CAT_LIST = () => window.BAL.catNames();
const fmtDate = (iso) => window.BAL.fmtDate(iso);
const grp = (n) => Math.abs(n).toLocaleString('en-IN');
const money = (n) => window.BAL.fmt(n);
const tint = (hex) => `color-mix(in oklab, ${hex} 15%, #fff 85%)`;
const inkc = (hex) => `color-mix(in oklab, ${hex} 78%, #000 22%)`;

const loadTxns = () => window.BAL.loadTxns();
const acctStats = (id, txns) => {
  let income = 0, spent = 0, count = 0, xferIn = 0, xferOut = 0;
  for (const t of txns) {
    if (t.type === 'transfer') {
      if (t.fromAccount === id) { xferOut += t.amount; count++; }
      else if (t.toAccount === id) { xferIn += t.amount; count++; }
      continue;
    }
    if (t.account === id) { count++; if (t.type === 'income') income += t.amount; else spent += t.amount; }
  }
  return { income, spent, count, xferIn, xferOut };
};
const signOf = (t) => t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';

function AccountModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => { if (!f.name.trim()) return; onSave({ ...f, opening: Number(f.opening) || 0 }); };
  return (
    <div className="lib-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial.id ? 'Edit account' : 'New account'}</h3>
          <button className="lib-x" onClick={onClose} aria-label="Close"><AIco d={AI.x} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Account name</label>
            <input value={f.name} placeholder="e.g. HDFC Savings" onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <Select value={f.type} onChange={(v) => set('type', v)} ariaLabel="Account type"
                options={TYPES.map((t) => ({ value: t, label: t }))} />
            </div>
            <div className="field">
              <label>Opening balance ({window.BAL.sym()})</label>
              <input type="number" value={f.opening} onChange={(e) => set('opening', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Number / handle</label>
            <input value={f.number} placeholder="•••• 1234" onChange={(e) => set('number', e.target.value)} />
          </div>
          <div className="field">
            <label>Colour</label>
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`sw${f.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>{initial.id ? 'Save changes' : 'Add account'}</button>
        </div>
      </div>
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
    let r = txns.filter((t) =>
      (type === 'all' || t.type === type) &&
      (cat === 'all' || t.category === cat) &&
      (!q || t.merchant.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)));
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
        <span className="arr" style={{ transform: sort.key === k && sort.dir === 'asc' ? 'rotate(180deg)' : 'none' }}><AIco d={AI.arrow} /></span></span>
    </th>
  );
  const Av = ({ t }) => { const h = CATS_COLOR(t.category); return <div className="tx-av" style={{ background: tint(h), color: inkc(h) }}>{t.merchant.replace(/^\W+/, '').charAt(0).toUpperCase()}</div>; };

  return (
    <div ref={ref}>
      <div className="txn-toolbar" style={{ marginBottom: 14 }}>
        <div className="txn-search">
          <AIco d={AI.search} />
          <input value={query} placeholder="Search this account…" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="txn-seg">
          {[['all', 'All'], ['expense', 'Expense'], ['income', 'Income']].map(([v, l]) => (
            <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
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
              <div className="tx-mid"><b>{t.merchant}</b>
                <div className="tx-sub"><i style={{ background: CATS_COLOR(t.category) }} />{t.category}</div></div>
              <div className="tx-right">
                <span className={`tx-amt ${t.type}`}>{signOf(t)}{window.BAL.fmt(t.amount)}</span>
                <span className="when">{fmtDate(t.date)}</span></div>
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
                  <td><span className="cat-pill"><i style={{ background: CATS_COLOR(t.category) }} />{t.category}</span></td>
                  <td><span className="tx-date">{fmtDate(t.date)}</span></td>
                  <td className={`tx-amt ${t.type}`}>{signOf(t)}{window.BAL.fmt(t.amount)}</td>
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
      <button onClick={() => onGo(page - 1)} disabled={page <= 1} aria-label="Previous"><AIco d={AI.prev} /></button>
      {nums.map((n, i) => n === '…' ? <span className="gap" key={`g${i}`}>…</span> : <button key={n} className={n === page ? 'on' : ''} onClick={() => onGo(n)}>{n}</button>)}
      <button onClick={() => onGo(page + 1)} disabled={page >= pages} aria-label="Next"><AIco d={AI.next} /></button>
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
      <button onClick={onEdit}><AIco d={AI.edit} />Edit account</button>
      <div className="sep" />
      <button className="danger" onClick={onDel}><AIco d={AI.trash} />Delete account</button>
    </div>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState(window.BAL.loadAccounts());
  const [txns, setTxns] = useState(loadTxns());
  const [selId, setSelId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [menuId, setMenuId] = useState(null);

  useEffect(() => { window.BAL.saveAccounts(accounts); }, [accounts]);
  useEffect(() => {
    const h = (e) => { if (!e.detail || e.detail === 'accounts') setTxns(loadTxns()); };
    window.addEventListener('balance:page', h);
    window.addEventListener('balance:txn-changed', () => setTxns(loadTxns()));
    return () => window.removeEventListener('balance:page', h);
  }, []);

  const onSave = useCallback((a) => {
    setAccounts((list) => a.id ? list.map((x) => x.id === a.id ? a : x) : [...list, { ...a, id: window.BAL.newId() }]);
    setEditing(null);
  }, []);
  const onDel = useCallback((id) => {
    setAccounts((list) => list.filter((x) => x.id !== id));
    setMenuId(null); setSelId(null);
  }, []);

  const blank = { name: '', type: 'Bank', number: '', color: COLORS[0], opening: '' };
  const sel = accounts.find((a) => a.id === selId);

  if (sel) {
    const s = acctStats(sel.id, txns);
    const balance = sel.opening + s.income - s.spent + s.xferIn - s.xferOut;
    const list = txns.filter((t) => t.account === sel.id || t.fromAccount === sel.id || t.toAccount === sel.id);
    return (
      <div className="acct">
        <button className="detail-back" onClick={() => setSelId(null)}><AIco d={AI.back} />All accounts</button>
        <div className="detail-hero">
          <div className="acct-ic" style={{ background: sel.color }}><AIco d={AI[TYPE_ICON[sel.type]]} /></div>
          <div className="hx"><h2>{sel.name}</h2><p>{sel.type} · {sel.number}</p></div>
          <div className="detail-acts">
            <button className="btn-ghost" onClick={() => setEditing(sel)}><AIco d={AI.edit} />Edit</button>
            <button className="btn-ghost" onClick={() => onDel(sel.id)}><AIco d={AI.trash} />Delete</button>
          </div>
        </div>
        <div className="acct-sum">
          <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.wallet2} /></span>Balance</div><b className={balance < 0 ? 'out' : ''}>{money(balance)}</b></div>
          <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.in} /></span>Income</div><b className="in">{window.BAL.fmt(s.income)}</b></div>
          <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.out} /></span>Spent</div><b className="out">{window.BAL.fmt(s.spent)}</b></div>
          <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.list} /></span>Transactions</div><b>{s.count}</b></div>
        </div>
        <TxnList txns={list} />
        {editing && <AccountModal key={editing.id || 'new'} initial={editing} onSave={onSave} onClose={() => setEditing(null)} />}
      </div>
    );
  }

  const totals = accounts.reduce((acc, a) => {
    const s = acctStats(a.id, txns);
    acc.balance += a.opening + s.income - s.spent + s.xferIn - s.xferOut; acc.income += s.income; acc.spent += s.spent; return acc;
  }, { balance: 0, income: 0, spent: 0 });

  return (
    <div className="acct">
      <div className="txn-head">
        <div><h2>Accounts</h2><p>{accounts.length} account{accounts.length === 1 ? '' : 's'} linked</p></div>
        <button className="btn-primary" onClick={() => setEditing(blank)}><AIco d={AI.plus} />New account</button>
      </div>

      <div className="acct-sum">
        <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.wallet2} /></span>Net balance</div><b className={totals.balance < 0 ? 'out' : ''}>{money(totals.balance)}</b></div>
        <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.in} /></span>Total income</div><b className="in">{window.BAL.fmt(totals.income)}</b></div>
        <div className="tile"><div className="tlab"><span className="tic"><AIco d={AI.out} /></span>Total spent</div><b className="out">{window.BAL.fmt(totals.spent)}</b></div>
      </div>

      <div className="acct-grid">
        {accounts.map((a) => {
          const s = acctStats(a.id, txns);
          const bal = a.opening + s.income - s.spent + s.xferIn - s.xferOut;
          return (
            <div className="acct-card" key={a.id} onClick={() => setSelId(a.id)}>
              <button className={`kebab${menuId === a.id ? ' open' : ''}`} aria-label="Account actions"
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === a.id ? null : a.id); }}><AIco d={AI.kebab} fill /></button>
              {menuId === a.id && (
                <div style={{ display: 'contents' }} onClick={(e) => e.stopPropagation()}>
                  <RowMenu onEdit={() => { setEditing(a); setMenuId(null); }} onDel={() => onDel(a.id)} onClose={() => setMenuId(null)} />
                </div>
              )}
              <div className="acct-top">
                <div className="acct-ic" style={{ background: a.color }}><AIco d={AI[TYPE_ICON[a.type]]} /></div>
                <div className="acct-id"><b>{a.name}</b><span>{a.type} · {a.number}</span></div>
              </div>
              <div className="acct-bal"><small>Current balance</small><b className={bal < 0 ? 'neg' : ''}>{money(bal)}</b></div>
              <div className="acct-foot">
                <div className="m"><span>Income</span><b className="in">{window.BAL.fmt(s.income)}</b></div>
                <div className="m"><span>Spent</span><b className="out">{window.BAL.fmt(s.spent)}</b></div>
                <div className="m"><span>Txns</span><b>{s.count}</b></div>
              </div>
            </div>
          );
        })}
        <button className="acct-add" onClick={() => setEditing(blank)}>
          <span className="pl"><AIco d={AI.plus} /></span>
          <b>Add account</b>
        </button>
      </div>

      {editing && <AccountModal key={editing.id || 'new'} initial={editing} onSave={onSave} onClose={() => setEditing(null)} />}
    </div>
  );
}
