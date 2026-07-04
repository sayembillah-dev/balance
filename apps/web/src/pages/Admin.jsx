/* Balance — Admin portal. Role-gated (rendered only for admins). Manage users,
   invitations, and instance settings. Talks directly to /api/v1/admin/*. */
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Select from '../components/Select.jsx';
import { Users, Envelope, SlidersHorizontal, Copy, Check } from '@phosphor-icons/react';

const G = ({ d: C, fill }) => (C ? <C weight={fill ? 'fill' : 'regular'} /> : null);
const GI = { users: Users, mail: Envelope, sliders: SlidersHorizontal };
const TABS = [
  { id: 'users', icon: GI.users, label: 'Users' },
  { id: 'invites', icon: GI.mail, label: 'Invitations' },
  { id: 'settings', icon: GI.sliders, label: 'Instance' },
];

const fmtDate = (s) => window.BAL.fmtDate(s);

const Badge = ({ label, variant = 'default' }) => {
  const map = {
    admin:    { background: 'var(--primary-soft)', color: 'var(--primary-ink)' },
    user:     { background: 'var(--bg)', color: 'var(--ink-3)', border: '1px solid var(--border)' },
    active:   { background: '#dcfce7', color: '#15803d' },
    inactive: { background: '#fee2e2', color: '#dc2626' },
    pending:  { background: '#fef9c3', color: '#854d0e' },
    accepted: { background: '#dcfce7', color: '#15803d' },
    expired:  { background: '#fee2e2', color: '#dc2626' },
    default:  { background: 'var(--bg)', color: 'var(--ink-2)' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      ...(map[variant] || map.default),
    }}>{label}</span>
  );
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button" role="switch" aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 44, height: 24, borderRadius: 12, border: 'none',
      cursor: 'pointer', flexShrink: 0, padding: 0, position: 'relative',
      background: checked ? 'var(--primary)' : 'var(--border)',
      transition: 'background 0.2s ease',
    }}
  >
    <span style={{
      display: 'block', width: 18, height: 18, borderRadius: 9, background: '#fff',
      position: 'absolute', top: 3, left: checked ? 23 : 3,
      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </button>
);

const SmBtn = ({ style, loading, children, ...props }) => (
  <button className="btn-ghost sm-btn" disabled={loading || props.disabled}
    style={{ height: 30, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, ...style }} {...props}>
    {loading && <span className="btn-spin" />}{children}
  </button>
);

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [settings, setSettings] = useState({ allowOpenSignups: false, instanceName: '' });
  const [err, setErr] = useState('');
  const [newInvite, setNewInvite] = useState({ email: '', role: 'user', expiresInDays: 7 });
  const [lastLink, setLastLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busyOp, setBusyOp] = useState('');

  const guard = (key, fn) => async (...a) => {
    setErr(''); setBusyOp(key(...a));
    try { return await fn(...a); } catch (e) { setErr(e?.message || 'Action failed'); }
    finally { setBusyOp(''); }
  };

  const loadUsers = useCallback(guard(() => 'load-users', async () => setUsers(await apiGet('/admin/users'))), []);
  const loadInvites = useCallback(guard(() => 'load-invites', async () => setInvites(await apiGet('/admin/invitations'))), []);
  const loadSettings = useCallback(guard(() => 'load-settings', async () => setSettings(await apiGet('/admin/settings'))), []);

  useEffect(() => { loadUsers(); loadInvites(); loadSettings(); }, [loadUsers, loadInvites, loadSettings]);

  const setRole = guard((u) => `role-${u.id}`, async (u, role) => { await apiPatch(`/admin/users/${u.id}`, { role }); loadUsers(); });
  const setActive = guard((u) => `active-${u.id}`, async (u, isActive) => { await apiPatch(`/admin/users/${u.id}`, { isActive }); loadUsers(); });
  const forceLogout = guard((u) => `logout-${u.id}`, async (u) => { await apiPost(`/admin/users/${u.id}/logout`, {}); });
  const setPassword = guard((u) => `pw-${u.id}`, async (u) => {
    const pw = window.prompt(`New password for ${u.email} (min 8 chars):`);
    if (!pw) return;
    await apiPost(`/admin/users/${u.id}/set-password`, { password: pw });
    window.alert('Password updated. The user has been signed out everywhere.');
  });
  const delUser = guard((u) => `del-${u.id}`, async (u) => {
    if (!window.confirm(`Delete ${u.email}? This removes all their data and cannot be undone.`)) return;
    await apiDelete(`/admin/users/${u.id}`); loadUsers();
  });

  const createInvite = guard(() => 'create-invite', async (e) => {
    e.preventDefault();
    const body = { role: newInvite.role, expiresInDays: Number(newInvite.expiresInDays) };
    if (newInvite.email.trim()) body.email = newInvite.email.trim();
    const res = await apiPost('/admin/invitations', body);
    setLastLink(window.location.origin + res.invitePath);
    setCopied(false);
    setNewInvite({ email: '', role: 'user', expiresInDays: 7 });
    loadInvites();
  });
  const revokeInvite = guard((i) => `revoke-${i.id}`, async (i) => { await apiDelete(`/admin/invitations/${i.id}`); loadInvites(); });

  const copyLink = () => {
    navigator.clipboard?.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSettings = guard(() => 'save-settings', async (patch) => setSettings(await apiPatch('/admin/settings', patch)));

  const inviteStatus = (i) => {
    if (i.acceptedAt) return 'accepted';
    if (new Date(i.expiresAt) < new Date()) return 'expired';
    return 'pending';
  };

  return (
    <div>
      <div className="txn-head" style={{ marginBottom: 18 }}>
        <div>
          <h2>Admin</h2>
          <p>Manage users, invitations and instance settings.</p>
        </div>
      </div>

      <div className="set-nav" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`set-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="ti"><G d={t.icon} /></span>{t.label}
          </button>
        ))}
      </div>

      {err && <p style={{ color: '#dc2626', margin: '0 0 12px' }}>{err}</p>}

      {/* ── Users ── */}
      {tab === 'users' && (
        <div className="txn-card">
          <div className="txn-tablewrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.name}
                        {self && <span style={{ opacity: 0.45, fontSize: 12, marginLeft: 4 }}>(you)</span>}
                      </td>
                      <td style={{ color: 'var(--ink-2)' }}>{u.email}</td>
                      <td><Badge label={u.role === 'admin' ? 'Admin' : 'User'} variant={u.role} /></td>
                      <td><Badge label={u.isActive ? 'Active' : 'Inactive'} variant={u.isActive ? 'active' : 'inactive'} /></td>
                      <td style={{ color: 'var(--ink-2)' }}>{fmtDate(u.createdAt)}</td>
                      <td>
                        {self ? (
                          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <SmBtn loading={busyOp === `role-${u.id}`} onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                              {u.role === 'admin' ? 'Make user' : 'Make admin'}
                            </SmBtn>
                            <SmBtn loading={busyOp === `active-${u.id}`} onClick={() => setActive(u, !u.isActive)}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </SmBtn>
                            <SmBtn loading={busyOp === `pw-${u.id}`} onClick={() => setPassword(u)}>Set password</SmBtn>
                            <SmBtn loading={busyOp === `logout-${u.id}`} onClick={() => forceLogout(u)}>Sign out</SmBtn>
                            <SmBtn loading={busyOp === `del-${u.id}`} style={{ color: '#dc2626' }} onClick={() => delUser(u)}>Delete</SmBtn>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invitations ── */}
      {tab === 'invites' && (
        <div className="txn-card">
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20, marginBottom: 20 }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-2)' }}>
              Generate a shareable invite link. If an email is provided, only that address can use it.
            </p>
            <form onSubmit={createInvite}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 120px', gap: 12, marginBottom: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Email (optional)</label>
                  <input className="txn-field" type="email" placeholder="anyone@example.com"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Role</label>
                  <Select value={newInvite.role} onChange={(v) => setNewInvite({ ...newInvite, role: v })}
                    ariaLabel="Invite role"
                    options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Expires (days)</label>
                  <input className="txn-field" type="number" min="1" max="90"
                    value={newInvite.expiresInDays}
                    onChange={(e) => setNewInvite({ ...newInvite, expiresInDays: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" type="submit" disabled={busyOp === 'create-invite'}>
                  {busyOp === 'create-invite' ? <><span className="btn-spin" />Creating…</> : 'Create invite'}
                </button>
              </div>
            </form>
          </div>

          {lastLink && (
            <div style={{
              background: 'var(--primary-soft)', borderRadius: 10, padding: '14px 16px',
              marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: 'var(--primary-ink)' }}>
                  Invite link ready
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{lastLink}</p>
              </div>
              <button className="btn-ghost" onClick={copyLink}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {copied
                  ? <><Check size={14} weight="bold" /> Copied</>
                  : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          )}

          <div className="txn-tablewrap">
            <table className="txn-table">
              <thead>
                <tr><th>Email</th><th>Role</th><th>Expires</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const status = inviteStatus(i);
                  return (
                    <tr key={i.id}>
                      <td>
                        {i.email || <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Any user</span>}
                      </td>
                      <td><Badge label={i.role === 'admin' ? 'Admin' : 'User'} variant={i.role} /></td>
                      <td style={{ color: 'var(--ink-2)' }}>{fmtDate(i.expiresAt)}</td>
                      <td>
                        <Badge
                          label={status.charAt(0).toUpperCase() + status.slice(1)}
                          variant={status}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {status === 'pending' && (
                          <SmBtn loading={busyOp === `revoke-${i.id}`} style={{ color: '#dc2626' }} onClick={() => revokeInvite(i)}>Revoke</SmBtn>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!invites.length && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ink-3)' }}>
                      No invitations yet. Create one above to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Instance settings ── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="txn-card" style={{ padding: '20px 24px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Instance name</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-2)' }}>
              Shown across the app and in invitation emails.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <label>Name</label>
                <input className="txn-field" value={settings.instanceName || ''}
                  onChange={(e) => setSettings({ ...settings, instanceName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && saveSettings({ instanceName: settings.instanceName })} />
              </div>
              <button className="btn-primary" disabled={busyOp === 'save-settings'} onClick={() => saveSettings({ instanceName: settings.instanceName })}>
                {busyOp === 'save-settings' ? <><span className="btn-spin" />Saving…</> : 'Save'}
              </button>
            </div>
          </div>

          <div className="txn-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Open sign-ups</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                  Allow anyone to create an account. When off, new users can only join via an invitation link.
                </p>
              </div>
              <Toggle
                checked={!!settings.allowOpenSignups}
                onChange={(v) => saveSettings({ allowOpenSignups: v })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
