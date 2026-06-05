/* Balance — Sign in / Sign up. Standalone branded auth screen. */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Logo = ({ stroke = '#fff' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="M5 8h9a3 3 0 0 1 0 6H5" /><path d="M5 14h11" />
  </svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [showPw, setShowPw] = useState(false);

  const go = (e) => { e.preventDefault(); navigate('/'); };

  return (
    <div className="auth" data-mode={mode}>
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

          <h2 className="fp-h">
            <span className="only-signin">Welcome back</span>
            <span className="only-signup">Create your account</span>
          </h2>
          <p className="fp-sub">
            <span className="only-signin">Sign in to pick up where you left off.</span>
            <span className="only-signup">Start managing your money in minutes.</span>
          </p>

          <form className="form" onSubmit={go}>
            <div className="field only-signup">
              <label htmlFor="name">Full name</label>
              <div className="input"><input id="name" type="text" placeholder="Ananya Sharma" autoComplete="name" /></div>
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input"><input id="email" type="email" placeholder="you@example.com" autoComplete="email" required /></div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input">
                <input id="password" type={showPw ? 'text' : 'password'} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
                <button type="button" className="toggle-pw" aria-label="Show password" onClick={() => setShowPw((v) => !v)} style={showPw ? { color: 'var(--primary-ink)' } : undefined}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="row-between only-signin">
              <label className="remember">
                <input type="checkbox" defaultChecked />
                <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg></span>
                Remember me
              </label>
              <a className="link">Forgot password?</a>
            </div>

            <label className="terms only-signup">
              <input type="checkbox" />
              <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17l9-10" /></svg></span>
              <span>I agree to the <a>Terms of Service</a> and <a>Privacy Policy</a>.</span>
            </label>

            <button type="submit" className="btn-primary">
              <span className="only-signin">Sign in</span>
              <span className="only-signup">Create account</span>
            </button>
          </form>

          <div className="divider">OR</div>

          <div className="socials">
            <button className="btn-social" onClick={() => navigate('/')}><span className="g">G</span>Continue with Google</button>
            <button className="btn-social" onClick={() => navigate('/')}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.4-.1 0-2.3-.9-2.3-3.5Zm-2.3-6.4c.6-.7 1-1.8.9-2.8-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.2Z" /></svg>
              Continue with Apple
            </button>
          </div>

          <div className="foot">
            <span className="only-signin">Don't have an account? <a onClick={() => setMode('signup')}>Sign up</a></span>
            <span className="only-signup">Already have an account? <a onClick={() => setMode('signin')}>Sign in</a></span>
          </div>
        </div>
      </main>
    </div>
  );
}
