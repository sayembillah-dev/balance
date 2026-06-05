import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pk, audit, timestamps, money } from '../columns.js';
import {
  budgetTimeframeEnum,
  budgetTrackEnum,
  budgetModeEnum,
  noteTypeEnum,
  payReceiveKindEnum,
} from '../enums.js';
import { users } from './users.js';
import { categories, tags } from './finance.js';

/**
 * A spending cap tracked by either a category or a tag. Tag budgets carry a
 * `mode`: `parallel` (also counts toward the category budget) or `isolated`
 * (counted only here). The CHECK enforces the track→fields shape.
 */
export const budgets = pgTable(
  'budgets',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    amountMinor: money('amount_minor'),
    timeframe: budgetTimeframeEnum('timeframe').notNull(),
    track: budgetTrackEnum('track').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'cascade',
    }),
    tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }),
    mode: budgetModeEnum('mode'),
    ...audit,
  },
  (t) => [
    index('budgets_user_idx').on(t.userId),
    check(
      'budget_track_shape',
      sql`(
        (${t.track} = 'category' and ${t.categoryId} is not null and ${t.tagId} is null)
        or
        (${t.track} = 'tag' and ${t.tagId} is not null and ${t.mode} is not null)
      )`,
    ),
  ],
);

/** Per-user singleton holding the savings pool. Goals draw from it; the
 *  invariant pool ≥ Σ(goal.saved) is enforced in the service layer. */
export const savings = pgTable('savings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  poolMinor: money('pool_minor').default(0),
  ...timestamps,
});

export const savingsGoals = pgTable(
  'savings_goals',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji'),
    title: text('title').notNull(),
    targetMinor: money('target_minor'),
    savedMinor: money('saved_minor').default(0),
    deadline: date('deadline'),
    ...audit,
  },
  (t) => [index('goals_user_idx').on(t.userId)],
);

/**
 * Notes and to-dos share one table via `type`. A `note` carries `body`; a `todo`
 * carries rows in `noteItems`. Both share title/color/timestamps and list together.
 */
export const notes = pgTable(
  'notes',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: noteTypeEnum('type').notNull(),
    title: text('title').notNull(),
    color: text('color'),
    body: text('body'),
    ...audit,
  },
  (t) => [index('notes_user_idx').on(t.userId)],
);

export const noteItems = pgTable(
  'note_items',
  {
    id: pk(),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...audit,
  },
  (t) => [index('note_items_note_idx').on(t.noteId)],
);

/** Money owed to you (receivable) or by you (payable), with settle tracking. */
export const payReceive = pgTable(
  'pay_receive',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: payReceiveKindEnum('kind').notNull(),
    party: text('party').notNull(),
    amountMinor: money('amount_minor'),
    dueDate: date('due_date'),
    note: text('note'),
    settled: boolean('settled').notNull().default(false),
    settledOn: date('settled_on'),
    ...audit,
  },
  (t) => [index('payrecv_user_idx').on(t.userId)],
);
