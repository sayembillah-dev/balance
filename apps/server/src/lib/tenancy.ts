import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

interface OwnedTable {
  userId: PgColumn;
  deletedAt: PgColumn;
}

/**
 * The standard WHERE for any user-owned, soft-deletable table: scoped to the
 * authenticated user AND excluding soft-deleted rows. Centralising this is the
 * structural defense against IDOR and against forgetting the deleted_at filter —
 * every list/get/update/delete query should start from here.
 */
export function owned(table: OwnedTable, userId: string): SQL {
  return and(eq(table.userId, userId), isNull(table.deletedAt))!;
}

/** Soft-delete patch: sets deleted_at to now. */
export function softDeleteSet() {
  return { deletedAt: new Date() };
}
