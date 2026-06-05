import { newId, type CategoryKind } from '@balance/shared';
import type { db } from './client.js';
import { categories, tags } from './schema/index.js';

// Accepts either the base client or a transaction handle — both expose insert().
type Inserter = Pick<typeof db, 'insert'>;

interface SeedCategory {
  kind: CategoryKind;
  name: string;
  color: string;
  subs: string[];
}

// Sensible starter taxonomy for a new account (mirrors the design mockup). No
// fake accounts or transactions — the user adds their own real accounts.
const DEFAULT_CATEGORIES: SeedCategory[] = [
  // ── Income (flat — no subcategories) ──────────────────────────────────────
  { kind: 'income', name: 'Salary / Wages', color: '#15803d', subs: [] },
  { kind: 'income', name: 'Freelance / Contract Work', color: '#0e7490', subs: [] },
  { kind: 'income', name: 'Business Revenue / Online Sales', color: '#2f6fe0', subs: [] },
  { kind: 'income', name: 'Allowances / Pocket Money', color: '#e0892f', subs: [] },
  { kind: 'income', name: 'Investment / Interest Returns', color: '#0d9488', subs: [] },
  { kind: 'income', name: 'Gifts Received', color: '#d6457a', subs: [] },
  { kind: 'income', name: 'Refunds / Reimbursements', color: '#64748b', subs: [] },

  // ── Expenses ──────────────────────────────────────────────────────────────
  { kind: 'expense', name: 'Housing & Utilities', color: '#2f6fe0', subs: ['Rent', 'Electricity', 'Water & Gas', 'Internet / Broadband', 'Home Maintenance'] },
  { kind: 'expense', name: 'Shopping', color: '#7c4dd8', subs: ['Gadgets & Electronics', 'Fashion Item', 'Clothing', 'Makeup & Cosmetics'] },
  { kind: 'expense', name: 'Food & Dining', color: '#e0892f', subs: ['Groceries', 'Restaurants / Dining Out', 'Coffee Shops / Snacks', 'Food Delivery'] },
  { kind: 'expense', name: 'Transportation', color: '#0e7490', subs: ['Public Transit', 'Ride-shares', 'Fuel / Gas', 'Vehicle Maintenance', 'Train / Plane'] },
  { kind: 'expense', name: 'Education', color: '#d6457a', subs: ['University Tuition', 'Books & Supplies', 'Online Courses / Certifications'] },
  { kind: 'expense', name: 'Tech & Subscriptions', color: '#475569', subs: ['Server Hosting', 'Software Licenses', 'Mobile Recharge / Data Packs', 'Streaming Services'] },
  { kind: 'expense', name: 'Business Operations', color: '#b45309', subs: ['Inventory Purchases', 'Courier / Shipping', 'Packaging Materials'] },
  { kind: 'expense', name: 'Entertainment & Hobbies', color: '#9333ea', subs: ['Gaming', 'Photography Gear & Editing Tools', 'Movies'] },
  { kind: 'expense', name: 'Health & Personal', color: '#16a34a', subs: ['Doctor Visits', 'Medicines', 'Gym / Fitness', 'Haircuts / Grooming', 'Lotions'] },
  { kind: 'expense', name: 'Financial & Fees', color: '#c0606a', subs: ['Bank Charges', 'Credit Card Payments', 'Loan Repayments'] },
  { kind: 'expense', name: 'Giving & Social', color: '#138a72', subs: ['Charity', 'Gifts Given', 'Club Memberships / Dues'] },
  { kind: 'expense', name: 'Others', color: '#64748b', subs: ['Lost', 'Unknown', 'Reconcile'] },
];

const DEFAULT_TAGS = [
  { name: 'Reimbursable', color: '#2f6fe0' },
  { name: 'Tax', color: '#138a72' },
  { name: 'Work', color: '#7c4dd8' },
  { name: 'Personal', color: '#e0892f' },
  { name: 'Subscription', color: '#d6457a' },
  { name: 'Essential', color: '#0e7490' },
];

/** Inserts the default categories (with subcategories) and tags for a user.
 *  Runs inside the user-creation transaction. */
export async function seedDefaultsForUser(
  tx: Inserter,
  userId: string,
): Promise<void> {
  const categoryRows = DEFAULT_CATEGORIES.flatMap((cat, i) => {
    const parentId = newId();
    const parent = {
      id: parentId,
      userId,
      parentId: null,
      kind: cat.kind,
      name: cat.name,
      color: cat.color,
      hidden: false,
      sortOrder: i,
    };
    const children = cat.subs.map((name, j) => ({
      id: newId(),
      userId,
      parentId,
      kind: cat.kind,
      name,
      color: null,
      hidden: false,
      sortOrder: j,
    }));
    return [parent, ...children];
  });

  await tx.insert(categories).values(categoryRows);
  await tx.insert(tags).values(DEFAULT_TAGS.map((t) => ({ ...t, userId })));
}
