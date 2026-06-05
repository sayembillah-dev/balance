/**
 * Canonical enum values shared across server (DB columns + validation) and web
 * (forms). Keep these in lockstep with the Drizzle pgEnum definitions.
 */

export const ACCOUNT_TYPES = ['Bank', 'Card', 'Wallet', 'Cash'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_MODES = ['UPI', 'Card', 'Bank', 'Cash', 'Transfer'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const CATEGORY_KINDS = ['expense', 'income'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const BUDGET_TIMEFRAMES = ['Weekly', 'Monthly', 'Yearly'] as const;
export type BudgetTimeframe = (typeof BUDGET_TIMEFRAMES)[number];

export const BUDGET_TRACKS = ['category', 'tag'] as const;
export type BudgetTrack = (typeof BUDGET_TRACKS)[number];

export const BUDGET_MODES = ['parallel', 'isolated'] as const;
export type BudgetMode = (typeof BUDGET_MODES)[number];

export const NOTE_TYPES = ['note', 'todo'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const PAY_RECEIVE_KINDS = ['receivable', 'payable'] as const;
export type PayReceiveKind = (typeof PAY_RECEIVE_KINDS)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
