import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  CATEGORY_KINDS,
  BUDGET_TIMEFRAMES,
  BUDGET_TRACKS,
  BUDGET_MODES,
  NOTE_TYPES,
  PAY_RECEIVE_KINDS,
  USER_ROLES,
} from '@balance/shared';

// Postgres enums derived from the single source of truth in @balance/shared,
// so DB columns, server validation, and web forms can never drift apart.
export const accountTypeEnum = pgEnum('account_type', ACCOUNT_TYPES);
export const transactionTypeEnum = pgEnum('transaction_type', TRANSACTION_TYPES);
export const categoryKindEnum = pgEnum('category_kind', CATEGORY_KINDS);
export const budgetTimeframeEnum = pgEnum('budget_timeframe', BUDGET_TIMEFRAMES);
export const budgetTrackEnum = pgEnum('budget_track', BUDGET_TRACKS);
export const budgetModeEnum = pgEnum('budget_mode', BUDGET_MODES);
export const noteTypeEnum = pgEnum('note_type', NOTE_TYPES);
export const payReceiveKindEnum = pgEnum('pay_receive_kind', PAY_RECEIVE_KINDS);
export const userRoleEnum = pgEnum('user_role', USER_ROLES);
