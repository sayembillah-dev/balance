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
  { kind: 'expense', name: 'Food', color: '#e0892f', subs: ['Restaurants', 'Coffee', 'Delivery', 'Snacks'] },
  { kind: 'expense', name: 'Grocery', color: '#3aa3a3', subs: ['Supermarket', 'Quick commerce'] },
  { kind: 'expense', name: 'Shopping', color: '#7c4dd8', subs: ['Clothing', 'Electronics', 'Online'] },
  { kind: 'expense', name: 'Travel', color: '#2f6fe0', subs: ['Flights', 'Trains', 'Cabs', 'Fuel'] },
  { kind: 'expense', name: 'Movie', color: '#d6457a', subs: ['Cinema', 'Streaming'] },
  { kind: 'expense', name: 'Bills', color: '#c0606a', subs: ['Electricity', 'Internet', 'Mobile', 'Subscriptions'] },
  { kind: 'expense', name: 'Health', color: '#16a34a', subs: ['Pharmacy', 'Doctor', 'Fitness'] },
  { kind: 'expense', name: 'Investment', color: '#138a72', subs: ['Stocks', 'Mutual Funds'] },
  { kind: 'income', name: 'Salary', color: '#15803d', subs: ['Monthly', 'Bonus'] },
  { kind: 'income', name: 'Freelance', color: '#0e7490', subs: ['Projects', 'Consulting'] },
  { kind: 'income', name: 'Investments', color: '#0d9488', subs: ['Dividends', 'Interest', 'Capital Gains'] },
  { kind: 'income', name: 'Other Income', color: '#64748b', subs: ['Refunds', 'Gifts'] },
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
