import { pgTable, uuid, char, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../columns.js';
import { budgetModeEnum } from '../enums.js';
import { users } from './users.js';

/**
 * Per-user behavioural preferences (singleton row keyed by userId). Profile
 * fields (name/email/phone) intentionally live on `users`, not here.
 */
export const settings = pgTable('settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currency: char('currency', { length: 3 }).notNull().default('INR'),
  // '1' | '25' | 'last' | 'payday' — when the user's budgeting month begins.
  monthStart: text('month_start').notNull().default('1'),
  rollover: boolean('rollover').notNull().default(true),
  tagBehavior: budgetModeEnum('tag_behavior').notNull().default('parallel'),
  privacyMask: boolean('privacy_mask').notNull().default(false),
  twoFactor: boolean('two_factor').notNull().default(false),
  loginAlerts: boolean('login_alerts').notNull().default(true),
  biometric: boolean('biometric').notNull().default(false),
  weeklyEmail: boolean('weekly_email').notNull().default(false),
  // Whether the user has completed (or skipped) the first-run onboarding flow.
  onboarded: boolean('onboarded').notNull().default(false),
  ...timestamps,
});

/** Per-user ordered dashboard widget list. The ordered string array is the one
 *  place jsonb is the right model (no per-widget data, order matters). */
export const dashboardLayouts = pgTable('dashboard_layouts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  widgetIds: jsonb('widget_ids')
    .notNull()
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  ...timestamps,
});
