/* Balance — Settings.
   Internal tabs; Preferences & Logic is the showcase.
   Draft/Save/Cancel persisted via the API (profile → /me, prefs → /me/settings). */
import React, { useState, useRef, useEffect } from 'react';
import { apiUpload, apiObjectUrl } from '../lib/api.js';

const G = ({ d, fill }) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const GI = { check: ['M5 12.5 10 17l9-10'], key: ['M14 7a4 4 0 1 0-3.5 6.9L9 15.5 7.5 17 6 18.5l1.5 1.5', 'M14 7a4 4 0 0 1 .5 8'], shield: ['M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z'], download: ['M12 3v12', 'm7 11 5 5 5-5', 'M5 21h14'] };
const STORE = 'balance.settings.v1';

const DEFAULTS = {
  name: 'Ananya Sharma', email: 'ananya@example.com', phone: '+91 98765 43210', timezone: 'Asia/Kolkata (GMT+5:30)',
  currency: 'INR', monthStart: '1', rollover: true, tagBehavior: 'parallel', privacy: false,
  twoFactor: true, loginAlerts: true, biometric: false,
  sync: true, googleDrive: false, weeklyEmail: true,
};
const load = () => ({ ...DEFAULTS, ...window.BAL.loadSettings() });

const CURRENCIES = [
  { v: 'INR', l: 'INR — ₹ (Indian Rupee)' }, { v: 'USD', l: 'USD — $ (US Dollar)' },
  { v: 'EUR', l: 'EUR — € (Euro)' }, { v: 'GBP', l: 'GBP — £ (Pound)' }, { v: 'BDT', l: 'BDT — ৳ (Taka)' },
];
const MONTH_START = [
  { v: '1', l: '1st of the month' }, { v: '25', l: '25th of the month' }, { v: 'last', l: 'Last day of month' }, { v: 'payday', l: 'On payday' },
];
const TABS = [
  { id: 'profile', emoji: '👤', label: 'General Profile' },
  { id: 'prefs', emoji: '⚙️', label: 'Preferences & Logic' },
  { id: 'security', emoji: '🔒', label: 'Security & Privacy' },
  { id: 'data', emoji: '🔌', label: 'Data & Integrations' },
];

const Switch = ({ on, onClick }) => <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={!!on} onClick={onClick}><i /></button>;
const Row = ({ title, sub, children, block, danger }) => (
  <div className={`set-row${block ? ' block' : ''}${danger ? ' danger' : ''}`}>
    <div className="rl"><b>{title}</b>{sub && <span>{sub}</span>}</div>
    {block ? children : <div className="rc">{children}</div>}
  </div>
);

function ProfilePanel({ d, set }) {
  return (
    <>
      <div className="set-group">
        <div className="set-profile">
          <div className="set-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}>
            {avatarUrl ? '' : d.name.charAt(0)}
          </div>
          <div className="pmeta"><b>{d.name || 'Your name'}</b><span>{d.email}</span></div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onPickPhoto} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Change photo</button>
        </div>
      </div>
      <div className="set-group">
        <Row title="Full name"><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink)' }} value={d.name} onChange={(e) => set('name', e.target.value)} /></Row>
        <Row title="Email address"><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink)' }} value={d.email} onChange={(e) => set('email', e.target.value)} /></Row>
        <Row title="Phone"><input className="txn-field" style={{ minWidth: 240, height: 42, color: 'var(--ink)' }} value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Row>
        <Row title="Time zone">
          <select className="txn-field" value={d.timezone} onChange={(e) => set('timezone', e.target.value)}>
            <option>Asia/Kolkata (GMT+5:30)</option><option>Asia/Dhaka (GMT+6:00)</option><option>America/New_York (GMT−5:00)</option><option>Europe/London (GMT+0:00)</option>
          </select>
        </Row>
      </div>
    </>
  );
}

function PrefsPanel({ d, set }) {
  return (
    <>
      <div className="set-group-t">Currency &amp; Localization</div>
      <div className="set-group">
        <Row title="Primary currency" sub="This is the primary currency used across your dashboards and analytics.">
          <select className="txn-field" value={d.currency} onChange={(e) => set('currency', e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Row>
        <Row title="Financial month start" sub="The day your monthly budgets reset and a new period begins.">
          <select className="txn-field" value={d.monthStart} onChange={(e) => set('monthStart', e.target.value)}>
            {MONTH_START.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </Row>
      </div>

      <div className="set-group-t">Budget &amp; Tag Configuration</div>
      <div className="set-group">
        <Row title="Enable budget rollover" sub="Automatically transfer unspent budget balances into the next month's limits.">
          <Switch on={d.rollover} onClick={() => set('rollover', !d.rollover)} />
        </Row>
        <Row block title="Default tag behaviour" sub="How new tag budgets interact with your standard category budgets by default.">
          <div className="radio-cards">
            <div className={`radio-card${d.tagBehavior === 'parallel' ? ' on' : ''}`} onClick={() => set('tagBehavior', 'parallel')}>
              <span className="radio-dot" />
              <div className="rc-txt"><b>Parallel tracking <span className="rec">Recommended</span></b><p>Tag budgets are tracked alongside standard category limits — a transaction counts toward both.</p></div>
            </div>
            <div className={`radio-card${d.tagBehavior === 'isolated' ? ' on' : ''}`} onClick={() => set('tagBehavior', 'isolated')}>
              <span className="radio-dot" />
              <div className="rc-txt"><b>Isolated tracking</b><p>Tagged transactions bypass normal category budgets completely and only count toward the tag.</p></div>
            </div>
          </div>
        </Row>
      </div>

      <div className="set-group-t">Privacy Display</div>
      <div className="set-group">
        <Row title="Mask dashboard balances" sub="Conceal monetary values on the main dashboard with dots (••••) for secure viewing in public.">
          <Switch on={d.privacy} onClick={() => set('privacy', !d.privacy)} />
        </Row>
      </div>
    </>
  );
}

function SecurityPanel({ d, set }) {
  return (
    <>
      <div className="set-group-t">Authentication</div>
      <div className="set-group">
        <Row title="Password" sub="Last changed 3 months ago."><button className="btn-ghost"><G d={GI.key} />Change password</button></Row>
        <Row title="Two-factor authentication" sub="Require a verification code at login for extra security."><Switch on={d.twoFactor} onClick={() => set('twoFactor', !d.twoFactor)} /></Row>
        <Row title="Biometric unlock" sub="Use Face ID / fingerprint to open the app on supported devices."><Switch on={d.biometric} onClick={() => set('biometric', !d.biometric)} /></Row>
      </div>
      <div className="set-group-t">Alerts</div>
      <div className="set-group">
        <Row title="Login alerts" sub="Email me whenever a new device signs in."><Switch on={d.loginAlerts} onClick={() => set('loginAlerts', !d.loginAlerts)} /></Row>
        <Row title="Active sessions" sub="iPhone 15 · Chrome on Mac · 2 devices."><button className="btn-ghost">Manage</button></Row>
      </div>
      <div className="set-group">
        <Row danger title="Delete account" sub="Permanently remove your account and all data. This cannot be undone."><button className="btn-ghost" style={{ color: '#c02626', borderColor: 'color-mix(in oklab,#e23b3b 30%,#fff)' }}>Delete</button></Row>
      </div>
    </>
  );
}

function DataPanel({ d, set }) {
  const integ = (logo, bg, name, meta, key) => (
    <div className="integ">
      <span className="ilogo" style={{ background: bg }}>{logo}</span>
      <div className="imeta"><b>{name}</b><span>{meta}</span></div>
      <span className={`conn-pill ${d[key] ? 'on' : 'off'}`}>{d[key] ? 'Connected' : 'Not connected'}</span>
      <Switch on={d[key]} onClick={() => set(key, !d[key])} />
    </div>
  );
  return (
    <>
      <div className="set-group-t">Connections</div>
      <div className="set-group">
        {integ('🏦', '#2f6fe0', 'Bank sync', 'Auto-import transactions from linked accounts', 'sync')}
        {integ('▲', '#15803d', 'Google Drive backup', 'Back up your data every night', 'googleDrive')}
      </div>
      <div className="set-group-t">Notifications</div>
      <div className="set-group">
        <Row title="Weekly summary email" sub="A digest of your spending every Monday morning."><Switch on={d.weeklyEmail} onClick={() => set('weeklyEmail', !d.weeklyEmail)} /></Row>
      </div>
      <div className="set-group-t">Your data</div>
      <div className="set-group">
        <Row title="Export data" sub="Download all your transactions, accounts and budgets as CSV."><button className="btn-ghost"><G d={GI.download} />Export CSV</button></Row>
        <Row title="Import data" sub="Bring in transactions from another app or a bank statement."><button className="btn-ghost">Import</button></Row>
      </div>
    </>
  );
}

export default function Settings() {
  const [saved, setSaved] = useState(load());
  const [d, setD] = useState(saved);
  const [tab, setTab] = useState('prefs');
  const [justSaved, setJustSaved] = useState(false);

  const set = (k, v) => { setD((p) => ({ ...p, [k]: v })); setJustSaved(false); };
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const save = () => { window.BAL.saveSettings(d); setSaved(d); setJustSaved(true); };
  const cancel = () => { setD(saved); setJustSaved(false); };

  // Avatar: fetch the saved image (private → blob URL), and upload on change.
  const fileRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  useEffect(() => {
    if (!d.avatarUploadId) { setAvatarUrl(''); return; }
    let url; let alive = true;
    apiObjectUrl(`/uploads/${d.avatarUploadId}`).then((u) => { if (alive) { url = u; setAvatarUrl(u); } }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [d.avatarUploadId]);
  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { id } = await apiUpload('/uploads', file); set('avatarUploadId', id); }
    catch (err) { window.alert(err?.message || 'Upload failed'); }
    e.target.value = '';
  };

  const cur = TABS.find((t) => t.id === tab);
  const Panel = { profile: ProfilePanel, prefs: PrefsPanel, security: SecurityPanel, data: DataPanel }[tab];

  return (
    <div>
      <div className="txn-head" style={{ marginBottom: 18 }}>
        <div><h2>Settings</h2><p>Manage your profile, preferences and app behaviour</p></div>
      </div>
      <div className="settings">
        <div className="set-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`set-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              <span className="ti">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="set-panel">
          <div><div className="set-h2">{cur.label}</div><div className="set-h2-d">{
            { profile: 'Your personal details and how we reach you.', prefs: 'Currency, budgeting logic and privacy controls.', security: 'Keep your account safe and private.', data: 'Connections, backups and exports.' }[tab]
          }</div></div>
          <Panel d={d} set={set} />
          <div className="set-foot">
            {justSaved && <span className="saved-note"><G d={GI.check} />All changes saved</span>}
            <button className="btn-ghost" onClick={cancel} disabled={!dirty} style={dirty ? null : { opacity: 0.5, cursor: 'default' }}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={!dirty} style={dirty ? null : { opacity: 0.5, cursor: 'default' }}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
