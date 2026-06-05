/* Balance — Admin portal. Role-gated (rendered only for admins). Manage users,
   invitations, and instance settings. Talks directly to /api/v1/admin/*. */
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const TABS = [
  { id: 'users', emoji: '👥', label: 'Users' },
  { id: 'invites', emoji: '✉️', label: 'Invitations' },
  { id: 'settings', emoji: '⚙️', label: 'Instance' },
];

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString() : '—');

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [settings, setSettings] = useState({ allowOpenSignups: false, instanceName: '' });
  const [err, setErr] = useState('');
  const [newInvite, setNewInvite] = useState({ email: '', role: 'user', expiresInDays: 7 });
  const [lastLink, setLastLink] = useState('');

  const guard = (fn) => async (...a) => {
    setErr('');
    try { return await fn(...a); } catch (e) { setErr(e?.message || 'Action failed'); }
  };

  const loadUsers = useCallback(guard(async () => setUsers(await apiGet('/admin/users'))), []);
  const loadInvites = useCallback(guard(async () => setInvites(await apiGet('/admin/invitations'))), []);
  const loadSettings = useCallback(guard(async () => setSettings(await apiGet('/admin/settings'))), []);

  useEffect(() => { loadUsers(); loadInvites(); loadSettings(); }, [loadUsers, loadInvites, loadSettings]);

  // ── user actions ─────────────────────────────────────────────────────────
  const setRole = guard(async (u, role) => { await apiPatch(`/admin/users/${u.id}`, { role }); loadUsers(); });
  const setActive = guard(async (u, isActive) => { await apiPatch(`/admin/users/${u.id}`, { isActive }); loadUsers(); });
  const forceLogout = guard(async (u) => { await apiPost(`/admin/users/${u.id}/logout`, {}); });
  const setPassword = guard(async (u) => {
    const pw = window.prompt(`New password for ${u.email} (min 8 chars):`);
    if (!pw) return;
    await apiPost(`/admin/users/${u.id}/set-password`, { password: pw });
    window.alert('Password updated. The user has been signed out everywhere.');
  });
  const delUser = guard(async (u) => {
    if (!window.confirm(`Delete ${u.email}? This removes all their data and cannot be undone.`)) return;
    await apiDelete(`/admin/users/${u.id}`); loadUsers();
  });

  // ── invitations ──────────────────────────────────────────────────────────
  const createInvite = guard(async (e) => {
    e.preventDefault();
    const body = { role: newInvite.role, expiresInDays: Number(newInvite.expiresInDays) };
    if (newInvite.email.trim()) body.email = newInvite.email.trim();
    const res = await apiPost('/admin/invitations', body);
    setLastLink(window.location.origin + res.invitePath);
    setNewInvite({ email: '', role: 'user', expiresInDays: 7 });
    loadInvites();
  });
  const revokeInvite = guard(async (i) => { await apiDelete(`/admin/invitations/${i.id}`); loadInvites(); });

  // ── settings ─────────────────────────────────────────────────────────────
  const saveSettings = guard(async (patch) => setSettings(await apiPatch('/admin/settings', patch)));

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
            <span className="ti">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      {err && <p style={{ color: '#dc2626', margin: '0 0 12px' }}>{err}</p>}

      {tab === 'users' && (
        <div className="txn-card">
          <div className="txn-tablewrap">
            <table className="txn-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td>{u.name}{self && <span style={{ opacity: 0.5 }}> (you)</span>}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!self && (
                          <>
                            <button className="btn-ghost" onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                              {u.role === 'admin' ? 'Make user' : 'Make admin'}
                            </button>
                            <button className="btn-ghost" onClick={() => setActive(u, !u.isActive)}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn-ghost" onClick={() => setPassword(u)}>Set password</button>
                            <button className="btn-ghost" onClick={() => forceLogout(u)}>Sign out</button>
                            <button className="btn-ghost" style={{ color: '#dc2626' }} onClick={() => delUser(u)}>Delete</button>
                          </>
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

      {tab === 'invites' && (
        <div className="txn-card">
          <form className="field" onSubmit={createInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div><label>Email (optional)</label><input className="txn-field" type="email" placeholder="anyone@example.com"
              value={newInvite.email} onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })} /></div>
            <div><label>Role</label><select className="txn-field" value={newInvite.role} onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}>
              <option value="user">User</option><option value="admin">Admin</option></select></div>
            <div><label>Expires (days)</label><input className="txn-field" type="number" min="1" max="90" style={{ width: 90 }}
              value={newInvite.expiresInDays} onChange={(e) => setNewInvite({ ...newInvite, expiresInDays: e.target.value })} /></div>
            <button className="btn-primary" type="submit">Create invite</button>
          </form>

          {lastLink && (
            <div style={{ background: 'var(--card-2,#f1f5f9)', padding: 12, borderRadius: 10, marginBottom: 16, wordBreak: 'break-all' }}>
              <b>Invite link</b> (shown once):<br />{lastLink}{' '}
              <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(lastLink)}>Copy</button>
            </div>
          )}

          <div className="txn-tablewrap">
            <table className="txn-table">
              <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email || '(any)'}</td>
                    <td>{i.role}</td>
                    <td>{fmtDate(i.expiresAt)}</td>
                    <td>{i.acceptedAt ? 'Accepted' : new Date(i.expiresAt) < new Date() ? 'Expired' : 'Pending'}</td>
                    <td>{!i.acceptedAt && <button className="btn-ghost" style={{ color: '#dc2626' }} onClick={() => revokeInvite(i)}>Revoke</button>}</td>
                  </tr>
                ))}
                {!invites.length && <tr><td colSpan={5} style={{ opacity: 0.6 }}>No invitations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="txn-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
          <div className="field">
            <label>Instance name</label>
            <input className="txn-field" value={settings.instanceName || ''}
              onChange={(e) => setSettings({ ...settings, instanceName: e.target.value })}
              onBlur={() => saveSettings({ instanceName: settings.instanceName })} />
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!settings.allowOpenSignups}
              onChange={(e) => saveSettings({ allowOpenSignups: e.target.checked })} />
            <span><b>Allow open sign-ups</b><br /><span style={{ opacity: 0.6, fontSize: 13 }}>When off, new users can only join via an invitation link.</span></span>
          </label>
        </div>
      )}
    </div>
  );
}
