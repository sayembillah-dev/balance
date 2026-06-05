/* Balance — shared data layer across page modules.
   Ported from the design prototype's shared.js. Exposes the same API on
   `window.BAL` so the page modules (which read window.BAL) work unchanged,
   and also exports BAL for direct imports. */

const BAL = (function () {
  const ACCT_STORE = 'balance.accounts.v1';
  const TXN_STORE = 'balance.txns.v4';
  const CAT_STORE = 'balance.cats.v1';
  const TAG_STORE = 'balance.tags.v1';
  const PRESET_STORE = 'balance.presets.v1';

  const ACCOUNTS_SEED = [
    { id: 'ac_hdfc',  name: 'HDFC Savings',      type: 'Bank',   number: '•••• 4291', color: '#2f6fe0', opening: 612000 },
    { id: 'ac_icici', name: 'ICICI Credit Card', type: 'Card',   number: '•••• 8830', color: '#7c4dd8', opening: 0 },
    { id: 'ac_paytm', name: 'Paytm Wallet',      type: 'Wallet', number: '@ananya',   color: '#138a72', opening: 8450 },
    { id: 'ac_cash',  name: 'Cash',              type: 'Cash',   number: 'In hand',   color: '#e0892f', opening: 15000 },
  ];

  function loadAccounts() {
    try { const s = JSON.parse(localStorage.getItem(ACCT_STORE)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return ACCOUNTS_SEED.map((a) => ({ ...a }));
  }
  function saveAccounts(list) { localStorage.setItem(ACCT_STORE, JSON.stringify(list)); }

  // ---- transactions seed ----
  const MERCHANTS = [
    ['Amazon', 'Shopping', 'expense', 'UPI'], ['Swiggy', 'Food', 'expense', 'UPI'],
    ['Zomato', 'Food', 'expense', 'Card'], ['IRCTC', 'Travel', 'expense', 'Card'],
    ['Uber', 'Travel', 'expense', 'UPI'], ['PVR Cinemas', 'Movie', 'expense', 'Card'],
    ['Groww', 'Investment', 'expense', 'Bank'], ['Zerodha', 'Investment', 'expense', 'Bank'],
    ['Netflix', 'Bills', 'expense', 'Card'], ['Spotify', 'Bills', 'expense', 'UPI'],
    ['Airtel', 'Bills', 'expense', 'UPI'], ['BigBasket', 'Grocery', 'expense', 'UPI'],
    ['Starbucks', 'Food', 'expense', 'Card'], ['Myntra', 'Shopping', 'expense', 'UPI'],
    ['Apollo Pharmacy', 'Health', 'expense', 'Cash'], ['Blinkit', 'Grocery', 'expense', 'UPI'],
    ['Ola', 'Travel', 'expense', 'UPI'], ['Croma', 'Shopping', 'expense', 'Card'],
    ['Salary — Acme Corp', 'Salary', 'income', 'Bank'], ['Freelance — Figma job', 'Freelance', 'income', 'Bank'],
    ['Refund — Amazon', 'Other Income', 'income', 'UPI'], ['Dividend', 'Investments', 'income', 'Bank'],
  ];
  const BASE = { Shopping: 2100, Food: 520, Grocery: 1750, Travel: 2460, Movie: 320, Investment: 5000, Bills: 420, Health: 760 };
  const INC = [86500, 42000, 2100, 3400];
  const TAG_MAP = { Bills: ['t_subs'], Investment: ['t_tax'], Travel: ['t_work'], Food: ['t_essential'], Grocery: ['t_essential'], Shopping: ['t_personal'], Health: ['t_essential'], Movie: ['t_personal'], Salary: ['t_work'], Freelance: ['t_work', 't_reimb'], Investments: ['t_tax'], 'Other Income': ['t_personal'] };

  function genTxns() {
    const out = [];
    let day = new Date('2025-06-30T00:00:00');
    for (let i = 0; i < 47; i++) {
      const [merchant, category, type, mode] = MERCHANTS[(i * 5 + 2) % MERCHANTS.length];
      const base = type === 'income' ? INC[i % INC.length] : (BASE[category] || 500);
      const amount = Math.max(20, Math.round(base * (0.55 + ((i * 17) % 60) / 60)));
      day = new Date(day.getTime() - (((i * 3) % 4) + 1) * 86400000);
      const account = type === 'income' ? 'ac_hdfc'
        : mode === 'Card' ? 'ac_icici'
        : mode === 'Cash' ? 'ac_cash'
        : (i % 2 ? 'ac_paytm' : 'ac_hdfc');
      let tags = TAG_MAP[category] ? [...TAG_MAP[category]] : [];
      if (i % 5 === 0 && type === 'expense') tags = [...new Set([...tags, 't_reimb'])];
      out.push({ id: 1000 + i, date: day.toISOString().slice(0, 10), merchant, category, type, mode, amount, account, tags });
    }
    return out;
  }

  function loadTxns() {
    try { const s = JSON.parse(localStorage.getItem(TXN_STORE)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    const seed = genTxns();
    localStorage.setItem(TXN_STORE, JSON.stringify(seed));
    return seed;
  }
  function saveTxns(list) { localStorage.setItem(TXN_STORE, JSON.stringify(list)); }

  // ---- categories taxonomy ----
  const sub = (name) => ({ id: 's_' + Math.random().toString(36).slice(2, 8), name, hidden: false });
  const CATEGORIES_SEED = [
    { id: 'c_food',   type: 'expense', name: 'Food',       color: '#e0892f', subs: ['Restaurants', 'Coffee', 'Delivery', 'Snacks'].map(sub) },
    { id: 'c_groc',   type: 'expense', name: 'Grocery',    color: '#3aa3a3', subs: ['Supermarket', 'Quick commerce'].map(sub) },
    { id: 'c_shop',   type: 'expense', name: 'Shopping',   color: '#7c4dd8', subs: ['Clothing', 'Electronics', 'Online'].map(sub) },
    { id: 'c_travel', type: 'expense', name: 'Travel',     color: '#2f6fe0', subs: ['Flights', 'Trains', 'Cabs', 'Fuel'].map(sub) },
    { id: 'c_movie',  type: 'expense', name: 'Movie',      color: '#d6457a', subs: ['Cinema', 'Streaming'].map(sub) },
    { id: 'c_bills',  type: 'expense', name: 'Bills',      color: '#c0606a', subs: ['Electricity', 'Internet', 'Mobile', 'Subscriptions'].map(sub) },
    { id: 'c_health', type: 'expense', name: 'Health',     color: '#16a34a', subs: ['Pharmacy', 'Doctor', 'Fitness'].map(sub) },
    { id: 'c_inv',    type: 'expense', name: 'Investment', color: '#138a72', subs: ['Stocks', 'Mutual Funds'].map(sub) },
    { id: 'c_salary', type: 'income',  name: 'Salary',       color: '#15803d', subs: ['Monthly', 'Bonus'].map(sub) },
    { id: 'c_free',   type: 'income',  name: 'Freelance',    color: '#0e7490', subs: ['Projects', 'Consulting'].map(sub) },
    { id: 'c_invinc', type: 'income',  name: 'Investments',  color: '#0d9488', subs: ['Dividends', 'Interest', 'Capital Gains'].map(sub) },
    { id: 'c_other',  type: 'income',  name: 'Other Income', color: '#64748b', subs: ['Refunds', 'Gifts'].map(sub) },
  ];

  function loadCategories() {
    try { const s = JSON.parse(localStorage.getItem(CAT_STORE)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return CATEGORIES_SEED.map((c) => ({ ...c, subs: c.subs.map((x) => ({ ...x })) }));
  }
  function saveCategories(list) { localStorage.setItem(CAT_STORE, JSON.stringify(list)); }
  function catColor(name) { const c = loadCategories().find((x) => x.name === name); return c ? c.color : '#9aa0aa'; }
  function catNames() { return loadCategories().map((c) => c.name); }
  function categoriesByType(type) {
    return loadCategories().filter((c) => c.type === type)
      .map((c) => ({ name: c.name, subs: c.subs.filter((s) => !s.hidden).map((s) => s.name) }));
  }

  // ---- tags ----
  const TAGS_SEED = [
    { id: 't_reimb',     name: 'Reimbursable', color: '#2f6fe0' },
    { id: 't_tax',       name: 'Tax',          color: '#138a72' },
    { id: 't_work',      name: 'Work',         color: '#7c4dd8' },
    { id: 't_personal',  name: 'Personal',     color: '#e0892f' },
    { id: 't_subs',      name: 'Subscription', color: '#d6457a' },
    { id: 't_essential', name: 'Essential',    color: '#0e7490' },
  ];
  function loadTags() {
    try { const s = JSON.parse(localStorage.getItem(TAG_STORE)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return TAGS_SEED.map((t) => ({ ...t }));
  }
  function saveTags(list) { localStorage.setItem(TAG_STORE, JSON.stringify(list)); }
  function tag(id) { return loadTags().find((t) => t.id === id) || null; }

  // ---- presets ----
  const PRESETS_SEED = [
    { id: 'pr1', name: 'Morning coffee', type: 'expense', merchant: 'Starbucks', category: 'Food', subcategory: 'Coffee', mode: 'Card', account: 'ac_icici', tags: ['t_personal'], amount: 380 },
    { id: 'pr2', name: 'Monthly rent', type: 'expense', merchant: 'Landlord', category: 'Bills', subcategory: '', mode: 'Bank', account: 'ac_hdfc', tags: [], amount: 28000 },
    { id: 'pr3', name: 'Salary credit', type: 'income', merchant: 'Salary — Acme Corp', category: 'Salary', subcategory: 'Monthly', mode: 'Bank', account: 'ac_hdfc', tags: ['t_work'], amount: null },
    { id: 'pr4', name: 'Groceries run', type: 'expense', merchant: 'BigBasket', category: 'Grocery', subcategory: 'Supermarket', mode: 'UPI', account: 'ac_paytm', tags: ['t_essential'], amount: null },
  ];
  function loadPresets() {
    try { const s = JSON.parse(localStorage.getItem(PRESET_STORE)); if (Array.isArray(s)) return s; } catch (e) {}
    return PRESETS_SEED.map((p) => ({ ...p, tags: [...(p.tags || [])] }));
  }
  function savePresets(list) { localStorage.setItem(PRESET_STORE, JSON.stringify(list)); }

  return {
    ACCT_STORE, TXN_STORE, CAT_STORE, TAG_STORE, ACCOUNTS_SEED, CATEGORIES_SEED, TAGS_SEED,
    loadAccounts, saveAccounts, loadTxns, saveTxns,
    loadCategories, saveCategories, catColor, catNames, categoriesByType,
    loadTags, saveTags, tag,
    PRESET_STORE, PRESETS_SEED, loadPresets, savePresets,
  };
})();

if (typeof window !== 'undefined') window.BAL = BAL;

export default BAL;
