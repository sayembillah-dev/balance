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
import AiChat from './components/AiChat.jsx';

const I = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  transactions: ['M7 7h13', 'm17 4 3 3-3 3', 'M17 17H4', 'm7 14-3 3 3 3'],
  accounts: ['M2.5 5.5h19v14h-19z', 'M2.5 10h19', 'M6.5 15.5h4'],
  categories: ['m12 3 9 5-9 5-9-5 9-5Z', 'm3 13 9 5 9-5'],
  tags: ['M3 7v5.2a2 2 0 0 0 .6 1.4l7 7a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8l-7-7A2 2 0 0 0 10.2 5H5a2 2 0 0 0-2 2Z', 'M7.5 9.5h.01'],
  savings: ['M8 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M14.5 5.8A5 5 0 1 1 18 15'],
  pay: ['M2.5 6h19v12h-19z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6 9.5v5M18 9.5v5'],
  note: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z', 'M14 3v5h5', 'M9 13h6M9 17h4'],
  budget: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 13h.01'],
  settings: ['M4 7h10', 'M17 4.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z', 'M20 17H10', 'M7 14.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z'],
  admin: ['M12 3 4 6v5c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z', 'm9 12 2 2 4-4'],
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

const NavSvg = ({ paths }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    {paths.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

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
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" /><path d="M5 8h9a3 3 0 0 1 0 6H5" /><path d="M5 14h11" />
                </svg>
              </span>
              <span className="brand-name">Balance</span>
            </div>
            <button className="side-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M9 4v16" />
                <path className="side-toggle-arrow" d="M13.4 9.5 15.9 12l-2.5 2.5" />
              </svg>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span className="nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <main className="main">
          <header className="topbar">
            <button className="topbar-burger" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" />
              </svg>
            </button>
            <div className="greeting">
              <h1>Hi, {firstName} <span>👋</span></h1>
              <p>Track all your expenses and transactions</p>
            </div>

            <div className="topbar-right">
              <div className="clock">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                11:11 PM <span className="sep">|</span> 31 June 2025
              </div>

              <div className="search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input type="text" placeholder="Search transactions…" onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const q = e.currentTarget.value.trim();
                  setPage('transactions');
                  window.dispatchEvent(new CustomEvent('balance:search', { detail: q }));
                }} />
              </div>

              <button className="topbar-add" onClick={openNewTxn}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                <span>New</span>
              </button>

              <button className="icon-btn" aria-label="AI assistant" onClick={openAi}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0Z" />
                </svg>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        </button>
      </div>

      <AddTxn />
      <AiChat />
    </>
  );
}
