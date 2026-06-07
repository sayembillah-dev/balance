/* Balance — app shell: sidebar nav, topbar, page routing (display toggle so each
   page stays mounted, matching the prototype), mobile drawer, collapse, FAB, and
   the global Add-transaction + AI chat hosts. */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { apiObjectUrl } from './lib/api.js';

import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Accounts from './pages/Accounts.jsx';
import Categories from './pages/Categories.jsx';
import Tags from './pages/Tags.jsx';
import Savings from './pages/Savings.jsx';
import PayReceive from './pages/PayReceive.jsx';
import Notes from './pages/Notes.jsx';
import Budgets from './pages/Budgets.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import AddTxn from './components/AddTxn.jsx';
import TxnDetail from './components/TxnDetail.jsx';
import AiChat from './components/AiChat.jsx';
import {
  SquaresFour, Receipt, CreditCard, Stack, Tag, PiggyBank, HandCoins, Note, ChartDonut,
  Gear, ShieldCheck, SidebarSimple, SignOut, List, MagnifyingGlass, Plus, Sparkle,
  Clock as ClockIcon,
} from '@phosphor-icons/react';

const I = {
  dashboard: SquaresFour, transactions: Receipt, accounts: CreditCard, categories: Stack,
  tags: Tag, savings: PiggyBank, pay: HandCoins, note: Note, budget: ChartDonut,
  settings: Gear, admin: ShieldCheck,
};

const NAV = [
  { group: 'Menu', items: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'categories', label: 'Categories' },
    { key: 'tags', label: 'Tags' },
    { key: 'savings', label: 'Saving & Goals' },
    { key: 'pay', label: 'Pay & Receive' },
    { key: 'note', label: 'Note' },
    { key: 'budget', label: 'Budgets' },
  ] },
  { group: 'General', items: [
    { key: 'settings', label: 'Settings' },
  ] },
];

const PAGES = {
  dashboard: Dashboard,
  transactions: Transactions,
  accounts: Accounts,
  categories: Categories,
  tags: Tags,
  savings: Savings,
  pay: PayReceive,
  note: Notes,
  budget: Budgets,
  settings: Settings,
  admin: Admin,
};

const NavSvg = ({ paths: C }) => (C ? <C /> : null);

// Live topbar clock — ticks every second and renders in the user's selected
// timezone (window.BAL.tz()), so changing the zone in Settings is reflected here.
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const tz = window.BAL.tz();
  const fmt = (locale, opts) => {
    try { return new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }).format(now); }
    catch { return new Intl.DateTimeFormat(locale, opts).format(now); }
  };
  // en-US → uppercase "PM"; en-GB → day-month-year date order.
  const time = fmt('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const date = fmt('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="clock" title={tz}>
      <ClockIcon />
      {time} <span className="sep">|</span> {date}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [active, setActive] = useState(() => localStorage.getItem('balance.active') || 'dashboard');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('balance.collapsed') === '1');
  const [navOpen, setNavOpen] = useState(false);

  const setPage = useCallback((key) => {
    setActive(key);
    localStorage.setItem('balance.active', key);
    setNavOpen(false);
    window.dispatchEvent(new CustomEvent('balance:page', { detail: key }));
  }, []);

  const { user, logout } = useAuth();
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  // The Admin page + nav item only exist for admins.
  const isAdmin = user?.role === 'admin';
  const navGroups = isAdmin
    ? NAV.map((g) => (g.group === 'General' ? { ...g, items: [...g.items, { key: 'admin', label: 'Admin' }] } : g))
    : NAV;
  const pageEntries = Object.entries(PAGES).filter(([k]) => k !== 'admin' || isAdmin);

  // Topbar avatar — fetch the private image as a blob URL (img can't send auth).
  const [avatarUrl, setAvatarUrl] = useState('');
  useEffect(() => {
    if (!user?.avatarUploadId) { setAvatarUrl(''); return; }
    let url; let alive = true;
    apiObjectUrl(`/uploads/${user.avatarUploadId}`).then((u) => { if (alive) { url = u; setAvatarUrl(u); } }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [user?.avatarUploadId]);

  // fire the initial page event so pages that depend on it measure/refresh
  useEffect(() => { window.dispatchEvent(new CustomEvent('balance:page', { detail: active })); }, []); // eslint-disable-line

  // Re-render the whole shell (and thus every mounted page) when the currency
  // changes, so amounts everywhere immediately reformat with the new symbol.
  const [, bumpCurrency] = useState(0);
  useEffect(() => {
    const h = () => bumpCurrency((n) => n + 1);
    window.addEventListener('balance:currency', h);
    return () => window.removeEventListener('balance:currency', h);
  }, []);

  // Global "navigate to page" event, used by widgets/components outside the shell.
  useEffect(() => {
    const h = (e) => { if (PAGES[e.detail]) setPage(e.detail); };
    window.addEventListener('balance:goto', h);
    return () => window.removeEventListener('balance:goto', h);
  }, [setPage]);

  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 760px)').matches) { setNavOpen(false); return; }
    setCollapsed((c) => { const n = !c; localStorage.setItem('balance.collapsed', n ? '1' : '0'); return n; });
  };

  const openNewTxn = () => window.dispatchEvent(new CustomEvent('balance:add-txn', { detail: { tab: 'expense' } }));
  const openAi = () => window.dispatchEvent(new CustomEvent('balance:ai-open'));

  const cls = `app${collapsed ? ' collapsed' : ''}${navOpen ? ' nav-open' : ''}`;

  return (
    <>
      <div className={cls}>
        {/* ===== SIDEBAR ===== */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">
              <span className="brand-mark">
                <img src="/logo.svg" alt="" />
              </span>
              <span className="brand-name">Balance</span>
            </div>
            <button className="side-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
              <SidebarSimple />
              <span className="side-toggle-tip">Open sidebar</span>
            </button>
          </div>

          <nav className="nav">
            {navGroups.map((section, si) => (
              <div key={section.group} style={{ display: 'contents' }}>
                {si > 0 && <div className="nav-divider" />}
                {section.items.map((it) => (
                  <button key={it.key} className={`nav-item${active === it.key ? ' active' : ''}`} data-key={it.key} onClick={() => setPage(it.key)}>
                    <NavSvg paths={I[it.key]} />
                    <span className="nav-text">{it.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button className="nav-item logout" data-key="logout" onClick={() => logout()}>
              <SignOut />
              <span className="nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <main className="main">
          <header className="topbar">
            <button className="topbar-burger" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <List />
            </button>
            <div className="greeting">
              <h1>Hi, {firstName} <span>👋</span></h1>
              <p>Track all your expenses and transactions</p>
            </div>

            <div className="topbar-right">
              <Clock />

              <div className="search">
                <MagnifyingGlass />
                <input type="text" placeholder="Search transactions…" onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const q = e.currentTarget.value.trim();
                  setPage('transactions');
                  window.dispatchEvent(new CustomEvent('balance:search', { detail: q }));
                }} />
              </div>

              <button className="topbar-add" onClick={openNewTxn}>
                <Plus weight="bold" />
                <span>New</span>
              </button>

              <button className="icon-btn" aria-label="AI assistant" onClick={openAi}>
                <Sparkle />
              </button>

              <div className="avatar" title="Settings" style={{ cursor: 'pointer', ...(avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}) }} onClick={() => setPage('settings')}>{avatarUrl ? '' : initial}</div>
            </div>
          </header>

          <section className="canvas">
            {pageEntries.map(([key, Page]) => (
              <div key={key} style={{ display: active === key ? '' : 'none' }}>
                <Page />
              </div>
            ))}
          </section>
        </main>

        <div className="scrim" onClick={() => setNavOpen(false)} />
        <button className="fab" onClick={openNewTxn} aria-label="New transaction">
          <Plus weight="bold" />
        </button>
      </div>

      <AddTxn />
      <TxnDetail />
      <AiChat />
    </>
  );
}
