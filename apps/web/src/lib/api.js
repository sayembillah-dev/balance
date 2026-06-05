/* Thin fetch wrapper around the Balance API.
   - Access token is held in memory (never localStorage) and sent as a Bearer.
   - The refresh token is an httpOnly cookie the browser sends automatically to
     /api/v1/auth/* ; on a 401 we transparently refresh once and retry.
   All requests are same-origin (the dev server proxies /api → :4000). */

const BASE = '/api/v1';

let accessToken = null;
let refreshing = null;

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || 'Request failed');
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}

function doFetch(path, opts, auth) {
  const isForm = opts.body instanceof FormData;
  const headers = { ...(opts.headers || {}) };
  if (opts.body != null && !isForm) headers['content-type'] = 'application/json';
  if (auth && accessToken) headers.authorization = `Bearer ${accessToken}`;
  return fetch(BASE + path, {
    ...opts,
    headers,
    credentials: 'include',
    body: opts.body != null && !isForm ? JSON.stringify(opts.body) : opts.body,
  });
}

/** Refreshes the access token (deduped across concurrent callers). */
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) throw new ApiError(r.status, { code: 'UNAUTHORIZED' });
        const data = await r.json();
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Core request. On a 401 (expired access token) it refreshes once and retries. */
export async function api(path, opts = {}, { auth = true, retry = true } = {}) {
  let res = await doFetch(path, opts, auth);

  if (res.status === 401 && auth && retry) {
    await refreshSession(); // throws if the refresh cookie is gone → caller logs out
    res = await doFetch(path, opts, true);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || { message: res.statusText });
  }
  return data;
}

export const apiGet = (path) => api(path);
export const apiPost = (path, body, opts) => api(path, { method: 'POST', body }, opts);
export const apiPatch = (path, body) => api(path, { method: 'PATCH', body });
export const apiPut = (path, body) => api(path, { method: 'PUT', body });
export const apiDelete = (path) => api(path, { method: 'DELETE' });
