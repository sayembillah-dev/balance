import { pgTable, uuid, text, bigint, index } from 'drizzle-orm/pg-core';
import { pk, timestamps } from '../columns.js';
import { users } from './users.js';

/**
 * Uploaded files (profile pictures, receipt photos). The actual bytes live in
 * the configured storage driver (local volume by default); this row holds the
 * storage key + metadata. Records reference an upload by id, never by URL, so
 * swapping storage backends doesn't require rewriting rows.
 */
export const uploads = pgTable(
  'uploads',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('uploads_user_idx').on(t.userId)],
);
