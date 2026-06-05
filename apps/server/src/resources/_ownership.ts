import { and, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { owned } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';

type OwnedRefTable = {
  id: PgColumn;
  userId: PgColumn;
  deletedAt: PgColumn;
};

/**
 * Guards against IDOR on foreign keys: confirms every referenced id (account,
 * category, tag, …) actually belongs to the authenticated user before it's
 * written onto a transaction/preset. The DB FKs guarantee existence but NOT
 * ownership, so this check is the tenancy boundary for cross-references.
 */
export async function assertOwnedIds(
  table: OwnedRefTable,
  ids: ReadonlyArray<string | null | undefined>,
  userId: string,
  label: string,
): Promise<void> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (list.length === 0) return;
  const found = await db
    .select({ id: table.id })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(table as any)
    .where(and(owned(table, userId), inArray(table.id, list)) as SQL);
  if (found.length !== list.length) {
    throw notFound(`${label} not found`);
  }
}
