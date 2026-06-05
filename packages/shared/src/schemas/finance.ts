import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  PAYMENT_MODES,
  CATEGORY_KINDS,
} from '../enums.js';

// Helper: build a zod enum from a readonly `as const` tuple while keeping the
// literal union as the inferred type.
const enumOf = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.enum(vals as unknown as [T[number], ...T[number][]]);

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const currency = z.string().length(3);
/** Money fields are integer minor units (paise/cents). */
const minorAmount = z.number().int();

// Clients may mint the row id (UUIDv7) so creates are idempotent and the future
// offline app can assign ids without a round-trip. Optional; the DB generates
// one when absent.
const clientId = z.string().uuid().optional();

// ── Accounts ────────────────────────────────────────────────────────────────
export const accountCreateSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(120),
  type: enumOf(ACCOUNT_TYPES),
  number: z.string().max(60).nullish(),
  color: z.string().min(1).max(32),
  openingMinor: minorAmount.default(0),
  currencyCode: currency.default('INR'),
});
export const accountUpdateSchema = accountCreateSchema.partial();
export type AccountCreate = z.infer<typeof accountCreateSchema>;

// ── Tags ─────────────────────────────────────────────────────────────────────
export const tagCreateSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(60),
  color: z.string().min(1).max(32),
});
export const tagUpdateSchema = tagCreateSchema.partial();

// ── Categories (self-referential; parentId set = subcategory) ────────────────
export const categoryCreateSchema = z.object({
  id: clientId,
  kind: enumOf(CATEGORY_KINDS),
  name: z.string().trim().min(1).max(80),
  color: z.string().max(32).nullish(),
  parentId: uuid.nullish(),
  hidden: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

// ── Transactions ─────────────────────────────────────────────────────────────
export const transactionCreateSchema = z
  .object({
    id: clientId,
    type: enumOf(TRANSACTION_TYPES),
    date: isoDate,
    amountMinor: minorAmount.positive(),
    currencyCode: currency.default('INR'),
    merchant: z.string().max(200).nullish(),
    mode: enumOf(PAYMENT_MODES).nullish(),
    accountId: uuid.nullish(),
    fromAccountId: uuid.nullish(),
    toAccountId: uuid.nullish(),
    categoryId: uuid.nullish(),
    subcategoryId: uuid.nullish(),
    receiptUploadId: uuid.nullish(),
    tags: z.array(uuid).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.type === 'transfer') {
      if (!d.fromAccountId || !d.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'transfer requires fromAccountId and toAccountId',
        });
      } else if (d.fromAccountId === d.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fromAccountId and toAccountId must differ',
        });
      }
    } else if (!d.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expense/income requires accountId',
      });
    }
  });
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

// Updates are a loose partial; the DB CHECK still guarantees final integrity.
export const transactionUpdateSchema = z.object({
  type: enumOf(TRANSACTION_TYPES).optional(),
  date: isoDate.optional(),
  amountMinor: minorAmount.positive().optional(),
  currencyCode: currency.optional(),
  merchant: z.string().max(200).nullish(),
  mode: enumOf(PAYMENT_MODES).nullish(),
  accountId: uuid.nullish(),
  fromAccountId: uuid.nullish(),
  toAccountId: uuid.nullish(),
  categoryId: uuid.nullish(),
  subcategoryId: uuid.nullish(),
  receiptUploadId: uuid.nullish(),
  tags: z.array(uuid).optional(),
});

export const transactionQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: enumOf(TRANSACTION_TYPES).optional(),
  accountId: uuid.optional(),
  categoryId: uuid.optional(),
  tagId: uuid.optional(),
  mode: enumOf(PAYMENT_MODES).optional(),
  q: z.string().max(200).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(['date', 'amount']).default('date'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

// ── Presets ──────────────────────────────────────────────────────────────────
export const presetCreateSchema = z.object({
  id: clientId,
  name: z.string().trim().min(1).max(120),
  type: z.enum(['expense', 'income']),
  merchant: z.string().max(200).nullish(),
  categoryId: uuid.nullish(),
  subcategoryId: uuid.nullish(),
  mode: enumOf(PAYMENT_MODES).nullish(),
  accountId: uuid.nullish(),
  amountMinor: minorAmount.positive().nullish(), // null = prompt on apply
  tags: z.array(uuid).default([]),
});
export const presetUpdateSchema = presetCreateSchema.partial();
