/* Balance — data layer.
   Preserves the synchronous window.BAL.loadX()/saveX() surface the page modules
   were built against, but backs it with the real API instead of localStorage:

   - loadX() returns an in-memory cache (kept synchronous so pages are unchanged).
   - hydrate() fetches every collection up front (called after login, before the
     app shell mounts) and fills the caches.
   - saveX(fullList) diffs the new list against the cache and fires create / patch
     / delete calls in the background (optimistic), then re-syncs on error.

   The API speaks clean DTOs (minor-unit money, category ids); this module is the
   single adapter between those and the mockup's legacy object shapes (rupee
   amounts, category *names*). Ids are client-minted UUIDv7 so create is idempotent
   and page state, cache, and server always agree on a row's id. */

import { newId, toMinor, toMajor, formatMoney, currencyMeta } from '@balance/shared';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './api.js';

// Active display/conversion currency — set from the user's settings on hydrate
// and changeable at runtime (e.g. from onboarding). Applied app-wide via fmt().
let CUR = 'INR';
function currency() { return CUR; }
function setCurrency(c) {
  CUR = c || 'INR';
  settingsObj = { ...settingsObj, currency: CUR };
  emitChanged();
  // Dedicated event so the app shell can re-render every (mounted) page at once —
  // money is formatted at render time, so all pages must refresh to pick up the
  // new symbol, not just the few that listen for data changes.
  window.dispatchEvent(new CustomEvent('balance:currency', { detail: CUR }));
}
function fmt(n) { return formatMoney(n, CUR); }
function sym() { return currencyMeta(CUR).symbol; }

// ── timezone (applied app-wide to date/time display) ─────────────────────────
// The user's IANA zone from settings. Legacy values were stored with an offset
// suffix ("Asia/Kolkata (GMT+5:30)") — strip it back to the zone id. Falls back
// to the browser's zone, then UTC.
function tz() {
  const saved = String(settingsObj.timezone || '').split(' (')[0].trim();
  if (saved) return saved;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Today's calendar date (YYYY-MM-DD) in the user's timezone, so new entries
// default to the right local day even when the server/browser sits elsewhere.
function today() {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}
// First calendar day (YYYY-MM-DD) of the current budget period for a given
// timeframe, in the user's timezone. Budgets count only spending on/after this
// day, so a fresh budget doesn't inherit prior months/weeks/years of expenses.
function budgetPeriodStart(timeframe) {
  const [y, m, d] = today().split('-').map(Number);
  if (timeframe === 'Yearly') return `${y}-01-01`;
  if (timeframe === 'Weekly') {
    // Week starts Monday; walk back to it as a wall-clock calendar date.
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // Mon=0 … Sun=6
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }
  // Monthly (default)
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

// Format a date for display. Date-only strings (YYYY-MM-DD) are wall-clock
// calendar dates with no zone, so they're rendered as-is (never shifted a day).
// Real timestamps are formatted in the user's timezone, with time when asked.
function fmtDate(value, { withYear = true, short = false, withTime = false } = {}) {
  if (value == null || value === '') return '—';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str) && !withTime) {
    const [y, m, d] = str.split('-').map(Number);
    const mon = MON[m - 1] || '';
    if (short) return `${d} ${mon}`;
    return withYear ? `${String(d).padStart(2, '0')} ${mon} ${y}` : `${String(d).padStart(2, '0')} ${mon}`;
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return '—';
  const opts = {
    timeZone: tz(), day: '2-digit', month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };
  try { return new Intl.DateTimeFormat('en-GB', opts).format(dt); }
  catch { return str; }
}

// ── in-memory caches (legacy shapes) ─────────────────────────────────────────
let accounts = [];
let txns = [];
let categories = [];
let tags = [];
let presets = [];
// batch-2 collections (budgets, savings, notes, pay/receive, settings, widgets)
let budgets = [];
let savings = { pool: 0, goals: [] };
let notes = [];
let payrecv = [];
let settingsObj = {};
let widgets = [];

// category id↔name lookups, rebuilt whenever categories change
let catIdToName = new Map();
let parentNameToId = new Map(); // `${type}|${name}` → parent id
let subKeyToId = new Map(); // `${parentId}|${subName}` → sub id

function rebuildCatMaps() {
  catIdToName = new Map();
  parentNameToId = new Map();
  subKeyToId = new Map();
  for (const c of categories) {
    catIdToName.set(c.id, c.name);
    parentNameToId.set(`${c.type}|${c.name}`, c.id);
    for (const s of c.subs || []) {
      catIdToName.set(s.id, s.name);
      subKeyToId.set(`${c.id}|${s.name}`, s.id);
    }
  }
}

const parentIdFor = (name, type) => parentNameToId.get(`${type}|${name}`) || null;
const subIdFor = (catName, type, subName) => {
  if (!subName) return null;
  const pid = parentIdFor(catName, type);
  return pid ? subKeyToId.get(`${pid}|${subName}`) || null : null;
};

// ── API → legacy adapters ────────────────────────────────────────────────────
const adaptAccount = (a) => ({
  id: a.id, name: a.name, type: a.type, number: a.number, color: a.color,
  opening: toMajor(a.openingMinor, a.currencyCode || CUR),
});
const adaptTag = (t) => ({ id: t.id, name: t.name, color: t.color });
const adaptCategory = (c) => ({
  id: c.id, type: c.kind, name: c.name, color: c.color,
  subs: (c.subs || []).map((s) => ({ id: s.id, name: s.name, hidden: s.hidden })),
});
const adaptTxn = (t) => ({
  id: t.id, date: t.date, merchant: t.merchant, type: t.type,
  amount: toMajor(t.amountMinor, t.currencyCode || CUR),
  account: t.accountId, fromAccount: t.fromAccountId, toAccount: t.toAccountId,
  category: catIdToName.get(t.categoryId) || '',
  subcategory: catIdToName.get(t.subcategoryId) || '',
  receiptUploadId: t.receiptUploadId || null,
  tags: t.tags || [],
});
const adaptPreset = (p) => ({
  id: p.id, name: p.name, type: p.type, merchant: p.merchant,
  account: p.accountId,
  category: catIdToName.get(p.categoryId) || '',
  subcategory: catIdToName.get(p.subcategoryId) || '',
  amount: p.amountMinor == null ? null : toMajor(p.amountMinor, CUR),
  tags: p.tags || [],
});

// ── legacy → API payloads ────────────────────────────────────────────────────
const toApiAccount = (a) => ({
  id: a.id, name: a.name, type: a.type, number: a.number || null, color: a.color,
  openingMinor: toMinor(Number(a.opening) || 0, CUR), currencyCode: CUR,
});
const toApiTag = (t) => ({ id: t.id, name: t.name, color: t.color });
const toApiTxn = (t) => ({
  id: t.id, type: t.type, date: t.date,
  amountMinor: toMinor(Number(t.amount) || 0, CUR),
  merchant: t.merchant || null,
  accountId: t.account || null,
  fromAccountId: t.fromAccount || null, toAccountId: t.toAccount || null,
  categoryId: parentIdFor(t.category, t.type), subcategoryId: subIdFor(t.category, t.type, t.subcategory),
  receiptUploadId: t.receiptUploadId || null,
  tags: t.tags || [],
});
const toApiPreset = (p) => ({
  id: p.id, name: p.name, type: p.type, merchant: p.merchant || null,
  categoryId: parentIdFor(p.category, p.type), subcategoryId: subIdFor(p.category, p.type, p.subcategory),
  accountId: p.account || null,
  amountMinor: p.amount === '' || p.amount == null ? null : toMinor(Number(p.amount), CUR),
  tags: p.tags || [],
});

function emitChanged() {
  window.dispatchEvent(new CustomEvent('balance:txn-changed'));
}

// ── generic diff sync for flat collections (accounts, tags, txns, presets) ───
function syncFlat(path, oldList, newList, toApi, refill) {
  const oldById = new Map(oldList.map((x) => [x.id, x]));
  const newById = new Map(newList.map((x) => [x.id, x]));
  const tasks = [];
  for (const item of newList) {
    const prev = oldById.get(item.id);
    const payload = toApi(item);
    if (!prev) {
      tasks.push(apiPost(path, payload));
    } else if (JSON.stringify(toApi(prev)) !== JSON.stringify(payload)) {
      const { id, ...patch } = payload;
      tasks.push(apiPatch(`${path}/${item.id}`, patch));
    }
  }
  for (const item of oldList) if (!newById.has(item.id)) tasks.push(apiDelete(`${path}/${item.id}`));
  runTasks(path, tasks, refill);
}

function runTasks(path, tasks, refill) {
  if (!tasks.length) return;
  Promise.allSettled(tasks).then((results) => {
    if (results.some((r) => r.status === 'rejected')) {
      console.error(`[bal] sync error on ${path}; re-fetching to reconcile`, results);
      refill?.();
    }
  });
}

// ── public API (window.BAL) ──────────────────────────────────────────────────
function loadAccounts() { return accounts; }
function saveAccounts(list) {
  const old = accounts;
  accounts = list;
  emitChanged();
  syncFlat('/accounts', old, list, toApiAccount, refillAccounts);
}

function loadTags() { return tags; }
function saveTags(list) {
  const old = tags;
  tags = list;
  emitChanged();
  syncFlat('/tags', old, list, toApiTag, refillTags);
}
function tag(id) { return tags.find((t) => t.id === id) || null; }

function loadTxns() { return txns; }
function saveTxns(list) {
  const old = txns;
  txns = list;
  emitChanged();
  syncFlat('/transactions', old, list, toApiTxn, refillTxns);
}

function loadPresets() { return presets; }
function savePresets(list) {
  const old = presets;
  presets = list;
  syncFlat('/presets', old, list, toApiPreset, refillPresets);
}

function loadCategories() { return categories; }
function saveCategories(list) {
  const old = categories;
  categories = list;
  rebuildCatMaps();
  emitChanged();
  syncCategories(old, list);
}

// Categories carry nested subs; each maps to its own (parent_id) row.
function syncCategories(oldList, newList) {
  const oldById = new Map(oldList.map((c) => [c.id, c]));
  const newById = new Map(newList.map((c) => [c.id, c]));
  const tasks = [];

  for (const c of newList) {
    const prev = oldById.get(c.id);
    if (!prev) {
      tasks.push(apiPost('/categories', { id: c.id, kind: c.type, name: c.name, color: c.color || null }));
    } else if (prev.name !== c.name || prev.color !== c.color) {
      tasks.push(apiPatch(`/categories/${c.id}`, { name: c.name, color: c.color || null }));
    }
    const oldSubs = new Map((prev?.subs || []).map((s) => [s.id, s]));
    const newSubs = new Map((c.subs || []).map((s) => [s.id, s]));
    for (const s of c.subs || []) {
      const ps = oldSubs.get(s.id);
      if (!ps) {
        tasks.push(apiPost('/categories', { id: s.id, kind: c.type, name: s.name, hidden: !!s.hidden, parentId: c.id }));
      } else if (ps.name !== s.name || ps.hidden !== s.hidden) {
        tasks.push(apiPatch(`/categories/${s.id}`, { name: s.name, hidden: !!s.hidden }));
      }
    }
    for (const s of prev?.subs || []) if (!newSubs.has(s.id)) tasks.push(apiDelete(`/categories/${s.id}`));
  }
  for (const c of oldList) if (!newById.has(c.id)) tasks.push(apiDelete(`/categories/${c.id}`));
  runTasks('/categories', tasks, refillCategories);
}

// derived helpers used across pages
function catColor(name) { const c = categories.find((x) => x.name === name); return c ? c.color : '#9aa0aa'; }
function catNames() { return categories.map((c) => c.name); }
function categoriesByType(type) {
  return categories
    .filter((c) => c.type === type)
    .map((c) => ({ name: c.name, subs: (c.subs || []).filter((s) => !s.hidden).map((s) => s.name) }));
}

// ── batch-2: budgets ─────────────────────────────────────────────────────────
const catNameToId = (name) => (categories.find((c) => c.name === name) || {}).id || null;
const adaptBudget = (b) => ({
  id: b.id, name: b.name, amount: toMajor(b.amountMinor, CUR), timeframe: b.timeframe,
  track: b.track, category: b.categoryId ? catIdToName.get(b.categoryId) : undefined,
  tagId: b.tagId || undefined, mode: b.mode || undefined,
});
const toApiBudget = (b) => ({
  id: b.id, name: b.name, amountMinor: toMinor(Number(b.amount) || 0, CUR),
  timeframe: b.timeframe, track: b.track,
  categoryId: b.track === 'category' ? catNameToId(b.category) : null,
  tagId: b.track === 'tag' ? b.tagId || null : null,
  mode: b.track === 'tag' ? b.mode || 'parallel' : null,
});
function loadBudgets() { return budgets; }
function saveBudgets(list) {
  const old = budgets; budgets = list; emitChanged();
  syncFlat('/budgets', old, list, toApiBudget, refillBudgets);
}

// ── batch-2: savings (pool + goals) ──────────────────────────────────────────
const adaptGoal = (g) => ({
  id: g.id, emoji: g.emoji, title: g.title,
  target: toMajor(g.targetMinor, CUR), saved: toMajor(g.savedMinor, CUR),
  deadline: g.deadline, created: (g.createdAt || '').slice(0, 10),
});
const toApiGoal = (g) => ({
  id: g.id, emoji: g.emoji || null, title: g.title,
  targetMinor: toMinor(Number(g.target) || 0, CUR), savedMinor: toMinor(Number(g.saved) || 0, CUR),
  deadline: g.deadline || null,
});
function loadSavings() { return savings; }
function saveSavings(data) {
  const old = savings; savings = data; emitChanged();
  const tasks = [];
  if ((old.pool || 0) !== (data.pool || 0)) {
    tasks.push(apiPatch('/savings', { poolMinor: toMinor(Number(data.pool) || 0, CUR) }));
  }
  const oldGoals = new Map((old.goals || []).map((g) => [g.id, g]));
  const newGoals = new Map((data.goals || []).map((g) => [g.id, g]));
  for (const g of data.goals || []) {
    const prev = oldGoals.get(g.id);
    if (!prev) tasks.push(apiPost('/savings/goals', toApiGoal(g)));
    else if (JSON.stringify(toApiGoal(prev)) !== JSON.stringify(toApiGoal(g))) {
      const { id, ...patch } = toApiGoal(g);
      tasks.push(apiPatch(`/savings/goals/${g.id}`, patch));
    }
  }
  for (const g of old.goals || []) if (!newGoals.has(g.id)) tasks.push(apiDelete(`/savings/goals/${g.id}`));
  runTasks('/savings', tasks, refillSavings);
}

// ── batch-2: notes (+ todo items) ────────────────────────────────────────────
const adaptNote = (n) => ({
  id: n.id, type: n.type, color: n.color, title: n.title,
  body: n.type === 'note' ? n.body ?? '' : undefined,
  items: n.type === 'todo' ? (n.items || []).map((i) => ({ id: i.id, text: i.text, done: i.done })) : undefined,
  updated: n.updatedAt,
});
const toApiNote = (n) => ({
  id: n.id, type: n.type, title: n.title || '', color: n.color || null,
  body: n.type === 'note' ? n.body || '' : null,
  // item ids are server-generated (omitted) since items are replaced wholesale
  items: n.type === 'todo' ? (n.items || []).map((i, idx) => ({ text: i.text || '', done: !!i.done, sortOrder: idx })) : [],
});
function loadNotes() { return notes; }
function saveNotes(list) {
  const old = notes; notes = list; emitChanged();
  syncFlat('/notes', old, list, toApiNote, refillNotes);
}

// ── batch-2: pay & receive ───────────────────────────────────────────────────
const adaptPR = (p) => ({
  id: p.id, kind: p.kind, party: p.party, amount: toMajor(p.amountMinor, CUR),
  due: p.dueDate, note: p.note, settled: p.settled, settledOn: p.settledOn,
});
const toApiPR = (p) => ({
  id: p.id, kind: p.kind, party: p.party, amountMinor: toMinor(Number(p.amount) || 0, CUR),
  dueDate: p.due || null, note: p.note || null, settled: !!p.settled, settledOn: p.settledOn || null,
});
function loadPayRecv() { return payrecv; }
function savePayRecv(list) {
  const old = payrecv; payrecv = list; emitChanged();
  syncFlat('/pay-receive', old, list, toApiPR, refillPayRecv);
}

// ── batch-2: settings (profile + prefs, flattened) ───────────────────────────
function loadSettings() { return settingsObj; }
function saveSettings(d) {
  settingsObj = { ...settingsObj, ...d };
  if (d.currency && d.currency !== CUR) setCurrency(d.currency); // apply app-wide live
  // profile fields → /me ; preference fields → /me/settings (privacy → privacyMask)
  apiPatch('/me', { name: d.name, phone: d.phone || null, timezone: d.timezone || null, avatarUploadId: d.avatarUploadId || null })
    .catch((e) => console.error('[bal] profile save failed', e));
  apiPatch('/me/settings', {
    currency: d.currency, monthStart: d.monthStart, rollover: d.rollover,
    tagBehavior: d.tagBehavior, privacyMask: !!d.privacy, twoFactor: !!d.twoFactor,
    loginAlerts: !!d.loginAlerts, biometric: !!d.biometric, weeklyEmail: !!d.weeklyEmail,
  }).catch((e) => console.error('[bal] settings save failed', e));
}

// ── batch-2: dashboard widgets ───────────────────────────────────────────────
function loadWidgets() { return widgets; }
function saveWidgets(list) {
  widgets = list;
  apiPut('/me/dashboard', { widgetIds: list }).catch((e) => console.error('[bal] widgets save failed', e));
}

// ── AI provider settings ─────────────────────────────────────────────────────
// Not hydrated up-front (lazy-loaded by the AI settings tab). The cache just
// avoids a double-fetch if the user navigates away and back.
let aiSettingsObj = null;

function loadAiSettings() { return aiSettingsObj; }
function setAiSettingsCache(data) { aiSettingsObj = data; }
function saveAiSettings(d) {
  // Optimistically update cache (only enabled + activeModelId)
  const patch = { enabled: d.enabled, activeModelId: d.activeModelId ?? null };
  aiSettingsObj = aiSettingsObj ? { ...aiSettingsObj, ...patch } : patch;
  return apiPatch('/me/ai-settings', patch).catch((e) => console.error('[bal] ai-settings save failed', e));
}

// ── hydration / reset ────────────────────────────────────────────────────────
async function refillAccounts() { accounts = (await apiGet('/accounts')).map(adaptAccount); emitChanged(); }
async function refillTags() { tags = (await apiGet('/tags')).map(adaptTag); emitChanged(); }
async function refillCategories() { categories = (await apiGet('/categories')).map(adaptCategory); rebuildCatMaps(); emitChanged(); }
async function refillPresets() { presets = (await apiGet('/presets')).map(adaptPreset); emitChanged(); }
async function refillBudgets() { budgets = (await apiGet('/budgets')).map(adaptBudget); emitChanged(); }
async function refillSavings() {
  const s = await apiGet('/savings');
  savings = { pool: toMajor(s.poolMinor || 0, CUR), goals: (s.goals || []).map(adaptGoal) };
  emitChanged();
}
async function refillNotes() { notes = (await apiGet('/notes')).map(adaptNote); emitChanged(); }
async function refillPayRecv() { payrecv = (await apiGet('/pay-receive')).map(adaptPR); emitChanged(); }
// The pages operate on the full transaction list, so page through the API
// (server caps a page at 100) following nextCursor until exhausted.
async function fetchAllTxns() {
  const out = [];
  let cursor = null;
  do {
    const qs = new URLSearchParams({ limit: '100', sort: 'date', dir: 'desc' });
    if (cursor) qs.set('cursor', cursor);
    const page = await apiGet(`/transactions?${qs.toString()}`);
    out.push(...(page.items || []));
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

async function refillTxns() {
  txns = (await fetchAllTxns()).map(adaptTxn);
  emitChanged();
}

async function hydrate() {
  const [accts, cats, tg, pres, allTxns, bud, sav, nts, pr, me, prefs, dash] =
    await Promise.all([
      apiGet('/accounts'),
      apiGet('/categories'),
      apiGet('/tags'),
      apiGet('/presets'),
      fetchAllTxns(),
      apiGet('/budgets'),
      apiGet('/savings'),
      apiGet('/notes'),
      apiGet('/pay-receive'),
      apiGet('/me'),
      apiGet('/me/settings'),
      apiGet('/me/dashboard'),
    ]);
  // Set the active currency before adapting any amounts.
  CUR = prefs.currency || 'INR';
  categories = cats.map(adaptCategory);
  rebuildCatMaps();
  accounts = accts.map(adaptAccount);
  tags = tg.map(adaptTag);
  presets = pres.map(adaptPreset);
  txns = allTxns.map(adaptTxn);
  budgets = bud.map(adaptBudget);
  savings = { pool: toMajor(sav.poolMinor || 0, CUR), goals: (sav.goals || []).map(adaptGoal) };
  notes = nts.map(adaptNote);
  payrecv = pr.map(adaptPR);
  widgets = dash.widgetIds || [];
  // Flatten profile (/me) + preferences (/me/settings) into the page's shape.
  settingsObj = {
    name: me.name, email: me.email, phone: me.phone || '', timezone: me.timezone || '',
    avatarUploadId: me.avatarUploadId || null,
    currency: prefs.currency ?? 'INR', monthStart: prefs.monthStart ?? '1',
    rollover: prefs.rollover ?? true, tagBehavior: prefs.tagBehavior ?? 'parallel',
    privacy: prefs.privacyMask ?? false, twoFactor: prefs.twoFactor ?? false,
    loginAlerts: prefs.loginAlerts ?? true, biometric: prefs.biometric ?? false,
    weeklyEmail: prefs.weeklyEmail ?? false, onboarded: prefs.onboarded ?? false,
  };
  emitChanged();
}

function clearCache() {
  accounts = []; txns = []; categories = []; tags = []; presets = [];
  budgets = []; savings = { pool: 0, goals: [] }; notes = []; payrecv = [];
  settingsObj = {}; widgets = [];
  rebuildCatMaps();
}

const BAL = {
  newId,
  fmt, sym, currency, setCurrency,
  tz, today, fmtDate, budgetPeriodStart,
  hydrate, clearCache,
  loadAccounts, saveAccounts,
  loadTxns, saveTxns,
  loadCategories, saveCategories, catColor, catNames, categoriesByType,
  loadTags, saveTags, tag,
  loadPresets, savePresets,
  loadBudgets, saveBudgets,
  loadSavings, saveSavings,
  loadNotes, saveNotes,
  loadPayRecv, savePayRecv,
  loadSettings, saveSettings,
  loadWidgets, saveWidgets,
  loadAiSettings, setAiSettingsCache, saveAiSettings,
};

if (typeof window !== 'undefined') window.BAL = BAL;

export default BAL;
