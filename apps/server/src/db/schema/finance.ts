import {
  pgTable,
  uuid,
  text,
  char,
  date,
  boolean,
  integer,
  bigint,
  index,
  check,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pk, audit, money } from '../columns.js';
import {
  transactionTypeEnum,
  categoryKindEnum,
} from '../enums.js';
import { users } from './users.js';
import { uploads } from './media.js';

export const accounts = pgTable(
  'accounts',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    number: text('number'),
    color: text('color').notNull(),
    openingMinor: money('opening_minor').default(0),
    currencyCode: char('currency_code', { length: 3 }).notNull().default('INR'),
    ...audit,
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

/**
 * Categories and subcategories share one self-referential table: `parentId` NULL
 * = a top-level category (carries `kind` + `color`); non-NULL = a subcategory of
 * that parent. Only one level is used today, but the model allows nesting.
 */
export const categories = pgTable(
  'categories',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'cascade',
    }),
    kind: categoryKindEnum('kind').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    hidden: boolean('hidden').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...audit,
  },
  (t) => [
    index('categories_user_idx').on(t.userId),
    index('categories_parent_idx').on(t.parentId),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    ...audit,
  },
  (t) => [index('tags_user_idx').on(t.userId)],
);

/**
 * One row per expense / income / transfer. Transfers reuse the same row with
 * `fromAccountId`/`toAccountId` set (and `accountId` NULL); expense/income set
 * `accountId`. The CHECK enforces that shape. Category/subcategory/account are
 * FKs (ON DELETE SET NULL) so renames are safe and orphaned refs can't form.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: transactionTypeEnum('type').notNull(),
    date: date('date').notNull(),
    amountMinor: money('amount_minor'),
    currencyCode: char('currency_code', { length: 3 }).notNull().default('INR'),
    merchant: text('merchant'),
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    fromAccountId: uuid('from_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    toAccountId: uuid('to_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    subcategoryId: uuid('subcategory_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    receiptUploadId: uuid('receipt_upload_id').references(() => uploads.id, {
      onDelete: 'set null',
    }),
    ...audit,
  },
  (t) => [
    index('tx_user_date_idx').on(t.userId, t.date),
    index('tx_user_account_date_idx').on(t.userId, t.accountId, t.date),
    index('tx_from_account_idx').on(t.fromAccountId),
    index('tx_to_account_idx').on(t.toAccountId),
    check(
      'tx_account_shape',
      sql`(
        (${t.type} in ('expense','income') and ${t.accountId} is not null
          and ${t.fromAccountId} is null and ${t.toAccountId} is null)
        or
        (${t.type} = 'transfer' and ${t.fromAccountId} is not null
          and ${t.toAccountId} is not null and ${t.fromAccountId} <> ${t.toAccountId})
      )`,
    ),
  ],
);

/** Many-to-many transaction ⇄ tag. Real junction table (not an array column) so
 *  tag queries are indexable and the model ports cleanly to SQLite later. */
export const transactionTags = pgTable(
  'transaction_tags',
  {
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index('txtag_tag_idx').on(t.tagId),
  ],
);

/** Reusable transaction templates. `amountMinor` NULL = prompt on apply. */
export const presets = pgTable(
  'presets',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: transactionTypeEnum('type').notNull(),
    merchant: text('merchant'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    subcategoryId: uuid('subcategory_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    accountId: uuid('account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    // Nullable: a preset with no amount prompts the user when applied.
    amountMinor: bigint('amount_minor', { mode: 'number' }),
    ...audit,
  },
  (t) => [index('presets_user_idx').on(t.userId)],
);

export const presetTags = pgTable(
  'preset_tags',
  {
    presetId: uuid('preset_id')
      .notNull()
      .references(() => presets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.presetId, t.tagId] })],
);
