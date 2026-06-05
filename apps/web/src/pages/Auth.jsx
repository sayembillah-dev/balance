/* Balance — Sign in / Sign up / first-run Setup. Branded auth screen wired to
   the real auth API via the AuthProvider. */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const Logo = ({ stroke = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="M5 8h9a3 3 0 0 1 0 6H5" /><path d="M5 14h11" />
  </svg>
);

export default function Auth() {
  const { status, login, signup, setup } = useAuth();
  const [params] = useSearchParams();
  const invite = params.get('invite') || '';

  const isSetup = status === 'needsSetup';
  const [mode, setMode] = useState(
    isSetup || params.get('mode') === 'signup' || invite ? 'signup' : 'signin',
  );
  const wantsName = isSetup || mode === 'signup';

  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // data-mode drives the only-signin / only-signup CSS visibility.
  const dataMode = wantsName ? 'signup' : 'signin';

  const submit = async (e) => {
    e.preventDefault();
    // Read straight from the form, not just React state: browser autofill can
    // populate the inputs without firing onChange, leaving state stale/empty.
    const fd = new FormData(e.currentTarget);
    const emailV = (fd.get('email') ?? email ?? '').toString().trim();
    const passwordV = (fd.get('password') ?? password ?? '').toString();
    const nameV = (fd.get('name') ?? name ?? '').toString().trim();

    setError('');
    setBusy(true);
    try {
      if (isSetup) await setup({ email: emailV, password: passwordV, name: nameV });
      else if (mode === 'signup') await signup({ email: emailV, password: passwordV, name: nameV, invite: invite || undefined });
      else await login(emailV, passwordV);
      // On success the AuthProvider flips status → the Gate swaps to the app.
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const headTitle = isSetup ? 'Set up your instance' : mode === 'signup' ? 'Create your account' : 'Welcome back';
  const headSub = isSetup
    ? 'Create the admin account for this Balance instance.'
    : mode === 'signup'
      ? 'Start managing your money in minutes.'
      : 'Sign in to pick up where you left off.';
  const cta = isSetup ? 'Create admin account' : mode === 'signup' ? 'Create account' : 'Sign in';

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
              <div className="pv-val">₹8,98,450</div>
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

          <h2 className="fp-h">{headTitle}</h2>
          <p className="fp-sub">{headSub}</p>

          <form className="form" onSubmit={submit}>
            {wantsName && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <div className="input">
                  <input id="name" name="name" type="text" placeholder="Ananya Sharma" autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input">
                <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input">
                <input id="password" name="password" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  autoComplete={wantsName ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={wantsName ? 8 : undefined} />
                <button type="button" className="toggle-pw" aria-label="Show password" onClick={() => setShowPw((v) => !v)} style={showPw ? { color: 'var(--primary-ink)' } : undefined}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <p style={{ color: '#dc2626', fontSize: 14, margin: '2px 0 0' }}>{error}</p>
            )}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : cta}
            </button>
          </form>

          {!isSetup && (
            <div className="foot">
              {mode === 'signin' ? (
                <span>Don't have an account? <a onClick={() => { setError(''); setMode('signup'); }}>Sign up</a></span>
              ) : (
                <span>Already have an account? <a onClick={() => { setError(''); setMode('signin'); }}>Sign in</a></span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
