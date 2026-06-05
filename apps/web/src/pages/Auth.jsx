/* Balance — Sign in / Sign up / first-run Setup / Forgot + Reset password.
   Branded auth screen wired to the real auth API via the AuthProvider. */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { apiPost } from '../lib/api.js';

const Logo = ({ stroke = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="M5 8h9a3 3 0 0 1 0 6H5" /><path d="M5 14h11" />
  </svg>
);

export default function Auth() {
  const { status, login, signup, setup } = useAuth();
  const [params] = useSearchParams();
  const invite = params.get('invite') || '';
  const resetToken = params.get('reset') || '';

  const isSetup = status === 'needsSetup';
  const [mode, setMode] = useState(
    isSetup || params.get('mode') === 'signup' || invite ? 'signup' : 'signin',
  );
  const [resetDone, setResetDone] = useState(false);

  // The active view. A ?reset=token link shows the "set new password" form.
  const view = isSetup ? 'setup' : (resetToken && !resetDone) ? 'reset' : mode;
  const showName = view === 'setup' || view === 'signup';
  const showEmail = view !== 'reset';
  const showPassword = view !== 'forgot';
  const newPassword = view === 'setup' || view === 'signup' || view === 'reset';

  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const dataMode = showName ? 'signup' : 'signin';

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const emailV = (fd.get('email') ?? email ?? '').toString().trim();
    const passwordV = (fd.get('password') ?? password ?? '').toString();
    const nameV = (fd.get('name') ?? name ?? '').toString().trim();

    setError(''); setNotice(''); setBusy(true);
    try {
      if (view === 'reset') {
        await apiPost('/auth/password-reset/confirm', { token: resetToken, password: passwordV });
        setResetDone(true); setMode('signin'); setPassword('');
        setNotice('Password updated — please sign in with your new password.');
        setBusy(false);
      } else if (view === 'forgot') {
        await apiPost('/auth/password-reset/request', { email: emailV });
        setNotice("If an account exists for that email, a reset link has been created. On a self-hosted instance without email configured, the link appears in your server logs.");
        setBusy(false);
      } else if (view === 'setup') {
        await setup({ email: emailV, password: passwordV, name: nameV });
      } else if (view === 'signup') {
        await signup({ email: emailV, password: passwordV, name: nameV, invite: invite || undefined });
      } else {
        await login(emailV, passwordV);
      }
      // On auth success the AuthProvider flips status → the Gate swaps to the app.
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const COPY = {
    setup: { h: 'Set up your instance', s: 'Create the admin account for this Balance instance.', cta: 'Create admin account' },
    signup: { h: 'Create your account', s: 'Start managing your money in minutes.', cta: 'Create account' },
    signin: { h: 'Welcome back', s: 'Sign in to pick up where you left off.', cta: 'Sign in' },
    forgot: { h: 'Reset your password', s: "Enter your email and we'll create a reset link.", cta: 'Send reset link' },
    reset: { h: 'Choose a new password', s: 'Enter a new password for your account.', cta: 'Set new password' },
  }[view];

  const goto = (m) => { setError(''); setNotice(''); setMode(m); };

  return (
    <div className="auth" data-mode={dataMode}>
      <aside className="brandpane">
        <div className="bp-logo">
          <span className="bp-mark"><Logo /></span>
          <b>Balance</b>
        </div>
        <div className="bp-head">
          <h1>Money, finally under control.</h1>
          <p>Track spending, fund goals and stay on budget — all in one calm, beautifully simple place.</p>
        </div>
        <div className="preview">
          <div className="pv-top">
            <div>
              <div className="pv-lab">Net balance</div>
              <div className="pv-val">$8,98,450</div>
            </div>
            <span className="pv-chip">+6.2%</span>
          </div>
          <div className="pv-bars">
            <i style={{ height: '40%' }} /><i style={{ height: '62%' }} /><i style={{ height: '48%' }} />
            <i style={{ height: '74%' }} /><i style={{ height: '58%' }} /><i className="hot" style={{ height: '92%' }} /><i style={{ height: '66%' }} />
          </div>
        </div>
      </aside>

      <main className="formpane">
        <div className="formwrap">
          <div className="fp-logo">
            <span className="m"><Logo /></span>
            <b>Balance</b>
          </div>

          <h2 className="fp-h">{COPY.h}</h2>
          <p className="fp-sub">{COPY.s}</p>

          <form className="form" onSubmit={submit}>
            {showName && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <div className="input">
                  <input id="name" name="name" type="text" placeholder="Ananya Sharma" autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
            )}

            {showEmail && (
              <div className="field">
                <label htmlFor="email">Email address</label>
                <div className="input">
                  <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
            )}

            {showPassword && (
              <div className="field">
                <label htmlFor="password">{view === 'reset' ? 'New password' : 'Password'}</label>
                <div className="input">
                  <input id="password" name="password" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    autoComplete={newPassword ? 'new-password' : 'current-password'}
                    value={password} onChange={(e) => setPassword(e.target.value)} required minLength={newPassword ? 8 : undefined} />
                  <button type="button" className="toggle-pw" aria-label="Show password" onClick={() => setShowPw((v) => !v)} style={showPw ? { color: 'var(--primary-ink)' } : undefined}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {view === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: -4 }}>
                <a className="link" style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => goto('forgot')}>Forgot password?</a>
              </div>
            )}

            {error && <p style={{ color: '#dc2626', fontSize: 14, margin: '2px 0 0' }}>{error}</p>}
            {notice && <p style={{ color: 'var(--primary-ink, #4338ca)', fontSize: 14, margin: '2px 0 0' }}>{notice}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : COPY.cta}
            </button>
          </form>

          {!isSetup && (
            <div className="foot">
              {view === 'signin' && <span>Don't have an account? <a onClick={() => goto('signup')}>Sign up</a></span>}
              {view === 'signup' && <span>Already have an account? <a onClick={() => goto('signin')}>Sign in</a></span>}
              {(view === 'forgot' || view === 'reset') && <span><a onClick={() => goto('signin')}>← Back to sign in</a></span>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
