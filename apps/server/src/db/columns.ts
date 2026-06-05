import { uuid, timestamp, integer, bigint } from 'drizzle-orm/pg-core';
import { newId } from '@balance/shared';

/**
 * Shared column conventions applied across the schema.
 *
 * - `pk()` — UUIDv7 primary key, generated app-side (see @balance/shared) so the
 *   future offline mobile app can mint IDs without server round-trips.
 * - `audit` — sync-readiness columns added to every user-owned entity now, even
 *   though the sync engine is deferred: created/updated timestamps, a soft-delete
 *   marker (so deletes propagate to other devices later), and a dormant `version`
 *   counter (column reserved; increment/conflict logic is intentionally unbuilt).
 * - `money()` — integer minor units (paise/cents) as bigint; see shared/money.ts.
 */

export const pk = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => newId());

export const audit = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
};

/** Created/updated only — for singletons and infra tables that aren't soft-deleted. */
export const timestamps = {
  createdAt: audit.createdAt,
  updatedAt: audit.updatedAt,
};

export const money = (name: string) => bigint(name, { mode: 'number' }).notNull();
