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

import { newId, toMinor, toMajor } from '@balance/shared';
import { apiGet, apiPost, apiPatch, apiDelete } from './api.js';

const CUR = 'INR'; // single-currency for now; per-account currency arrives later

// ── in-memory caches (legacy shapes) ─────────────────────────────────────────
let accounts = [];
let txns = [];
let categories = [];
let tags = [];
let presets = [];

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
  id: t.id, date: t.date, merchant: t.merchant, type: t.type, mode: t.mode,
  amount: toMajor(t.amountMinor, t.currencyCode || CUR),
  account: t.accountId, fromAccount: t.fromAccountId, toAccount: t.toAccountId,
  category: catIdToName.get(t.categoryId) || '',
  subcategory: catIdToName.get(t.subcategoryId) || '',
  tags: t.tags || [],
});
const adaptPreset = (p) => ({
  id: p.id, name: p.name, type: p.type, merchant: p.merchant, mode: p.mode,
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
  merchant: t.merchant || null, mode: t.mode || null,
  accountId: t.account || null,
  fromAccountId: t.fromAccount || null, toAccountId: t.toAccount || null,
  categoryId: parentIdFor(t.category, t.type), subcategoryId: subIdFor(t.category, t.type, t.subcategory),
  tags: t.tags || [],
});
const toApiPreset = (p) => ({
  id: p.id, name: p.name, type: p.type, merchant: p.merchant || null,
  categoryId: parentIdFor(p.category, p.type), subcategoryId: subIdFor(p.category, p.type, p.subcategory),
  mode: p.mode || null, accountId: p.account || null,
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

// ── hydration / reset ────────────────────────────────────────────────────────
async function refillAccounts() { accounts = (await apiGet('/accounts')).map(adaptAccount); emitChanged(); }
async function refillTags() { tags = (await apiGet('/tags')).map(adaptTag); emitChanged(); }
async function refillCategories() { categories = (await apiGet('/categories')).map(adaptCategory); rebuildCatMaps(); emitChanged(); }
async function refillPresets() { presets = (await apiGet('/presets')).map(adaptPreset); emitChanged(); }
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
  const [accts, cats, tg, pres, allTxns] = await Promise.all([
    apiGet('/accounts'),
    apiGet('/categories'),
    apiGet('/tags'),
    apiGet('/presets'),
    fetchAllTxns(),
  ]);
  categories = cats.map(adaptCategory);
  rebuildCatMaps();
  accounts = accts.map(adaptAccount);
  tags = tg.map(adaptTag);
  presets = pres.map(adaptPreset);
  txns = allTxns.map(adaptTxn);
  emitChanged();
}

function clearCache() {
  accounts = []; txns = []; categories = []; tags = []; presets = [];
  rebuildCatMaps();
}

const BAL = {
  newId,
  hydrate, clearCache,
  loadAccounts, saveAccounts,
  loadTxns, saveTxns,
  loadCategories, saveCategories, catColor, catNames, categoriesByType,
  loadTags, saveTags, tag,
  loadPresets, savePresets,
};

if (typeof window !== 'undefined') window.BAL = BAL;

export default BAL;
