import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, timestamps } from '../columns.js';
import { userRoleEnum } from '../enums.js';

/**
 * Accounts that sign in to the instance. Profile fields (name/phone/timezone)
 * live here; behavioural preferences live in `settings`.
 *
 * `avatarUploadId` is a soft reference (plain uuid, no DB FK) to avoid a circular
 * FK with `uploads` (which already points back at users); the app keeps it valid.
 */
export const users = pgTable(
  'users',
  {
    id: pk(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    timezone: text('timezone'),
    role: userRoleEnum('role').notNull().default('user'),
    // Bumping this invalidates every previously issued access token ("log out
    // everywhere"). Access tokens carry the value they were minted with.
    tokenVersion: integer('token_version').notNull().default(0),
    isActive: integer('is_active').notNull().default(1),
    avatarUploadId: uuid('avatar_upload_id'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
);

/**
 * Refresh tokens, stored hashed and rotated on every use. A token belongs to a
 * `familyId`; presenting an already-rotated token is treated as theft and the
 * whole family is revoked (OWASP reuse-detection).
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('refresh_token_hash_uq').on(t.tokenHash),
    index('refresh_user_idx').on(t.userId),
    index('refresh_family_idx').on(t.familyId),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('pwreset_token_hash_uq').on(t.tokenHash),
    index('pwreset_user_idx').on(t.userId),
  ],
);

/** Admin-issued invites. A valid unused invite lets someone register even when
 *  open signups are off. */
export const invitations = pgTable(
  'invitations',
  {
    id: pk(),
    email: text('email'),
    tokenHash: text('token_hash').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedById: uuid('accepted_by_id'),
    createdAt: timestamps.createdAt,
  },
  (t) => [uniqueIndex('invite_token_hash_uq').on(t.tokenHash)],
);

/** Instance-wide key/value settings (e.g. `allow_open_signups`, SMTP config,
 *  instance name). Not user-scoped. */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamps.updatedAt,
});
