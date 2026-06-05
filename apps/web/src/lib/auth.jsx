/* Auth state for the web app. Holds the current user, restores the session on
   reload (refresh cookie → access token → /me), and exposes login/signup/setup/
   logout. Data is hydrated into window.BAL before `status` flips to 'authed', so
   pages mount with populated caches. */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, apiPost, setAccessToken, refreshSession } from './api.js';
import BAL from './bal.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // status: 'loading' | 'needsSetup' | 'anon' | 'authed'
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);

  // Hydrate app data, then mark authed.
  const enter = useCallback(async (u) => {
    await BAL.hydrate();
    setUser(u);
    setStatus('authed');
  }, []);

  const restore = useCallback(async () => {
    const bs = await api('/auth/bootstrap-status', {}, { auth: false }).catch(() => ({ needsSetup: false }));
    if (bs.needsSetup) {
      setStatus('needsSetup');
      return;
    }
    try {
      // refreshSession() is deduped: even if this runs twice (React StrictMode
      // double-invokes effects in dev), only ONE /auth/refresh fires — otherwise
      // the second call replays an already-rotated token and reuse-detection
      // would revoke the whole session.
      await refreshSession();
      const me = await api('/me');
      await enter(me);
    } catch {
      setStatus('anon');
    }
  }, [enter]);

  // Run exactly once on mount (the ref guard also neutralises StrictMode's
  // double-invoke, so we never fire a redundant refresh).
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    restore();
  }, [restore]);

  const login = useCallback(async (email, password) => {
    const { accessToken, user: u } = await apiPost('/auth/login', { email, password }, { auth: false });
    setAccessToken(accessToken);
    await enter(u);
  }, [enter]);

  const signup = useCallback(async (payload) => {
    const { accessToken, user: u } = await apiPost('/auth/signup', payload, { auth: false });
    setAccessToken(accessToken);
    await enter(u);
  }, [enter]);

  const setup = useCallback(async (payload) => {
    const { accessToken, user: u } = await apiPost('/auth/setup', payload, { auth: false });
    setAccessToken(accessToken);
    await enter(u);
  }, [enter]);

  const logout = useCallback(async () => {
    try { await apiPost('/auth/logout', {}, { auth: false }); } catch { /* best effort */ }
    setAccessToken(null);
    BAL.clearCache();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = { status, user, login, signup, setup, logout, needsSetup: status === 'needsSetup' };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
