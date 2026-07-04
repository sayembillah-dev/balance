import { z } from 'zod';
import {
  BUDGET_TIMEFRAMES,
  BUDGET_TRACKS,
  BUDGET_MODES,
  NOTE_TYPES,
  PAY_RECEIVE_KINDS,
  RECURRENCE_FREQUENCIES,
} from '../enums.js';

const enumOf = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.enum(vals as unknown as [T[number], ...T[number][]]);

const uuid = z.string().uuid();
const clientId = uuid.optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const minor = z.number().int();

// ── Budgets ──────────────────────────────────────────────────────────────────
export const budgetCreateSchema = z
  .object({
    id: clientId,
    name: z.string().trim().min(1).max(120),
    amountMinor: minor.positive(),
    timeframe: enumOf(BUDGET_TIMEFRAMES),
    track: enumOf(BUDGET_TRACKS),
    categoryId: uuid.nullish(),
    tagId: uuid.nullish(),
    mode: enumOf(BUDGET_MODES).nullish(),
    // When on, the budget auto-renews at the end of each `timeframe` period and
    // the elapsed period is archived (cap vs. actual spent). `periodStart` is
    // server-managed, so it isn't accepted from the client.
    recurring: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.track === 'category' && !d.categoryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'category budget requires categoryId' });
    }
    if (d.track === 'tag' && (!d.tagId || !d.mode)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tag budget requires tagId and mode' });
    }
  });
export const budgetUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  amountMinor: minor.positive().optional(),
  timeframe: enumOf(BUDGET_TIMEFRAMES).optional(),
  track: enumOf(BUDGET_TRACKS).optional(),
  categoryId: uuid.nullish(),
  tagId: uuid.nullish(),
  mode: enumOf(BUDGET_MODES).nullish(),
  recurring: z.boolean().optional(),
});

// ── Savings (pool singleton + goals) ─────────────────────────────────────────
export const savingsPoolSchema = z.object({ poolMinor: minor.min(0) });

export const goalCreateSchema = z.object({
  id: clientId,
  emoji: z.string().max(16).nullish(),
  title: z.string().trim().min(1).max(120),
  targetMinor: minor.positive(),
  savedMinor: minor.min(0).default(0),
  deadline: isoDate.nullish(),
});
export const goalUpdateSchema = goalCreateSchema.partial();

// ── Notes (+ todo items) ─────────────────────────────────────────────────────
const noteItemSchema = z.object({
  id: clientId,
  text: z.string().max(500).default(''),
  done: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export const noteCreateSchema = z.object({
  id: clientId,
  type: enumOf(NOTE_TYPES),
  title: z.string().trim().max(160).default(''),
  color: z.string().max(32).nullish(),
  body: z.string().max(20000).nullish(),
  items: z.array(noteItemSchema).default([]),
});
export const noteUpdateSchema = z.object({
  title: z.string().trim().max(160).optional(),
  color: z.string().max(32).nullish(),
  body: z.string().max(20000).nullish(),
  items: z.array(noteItemSchema).optional(),
});

// ── Pay & Receive ────────────────────────────────────────────────────────────
const payReceiveBase = z.object({
  id: clientId,
  kind: enumOf(PAY_RECEIVE_KINDS),
  party: z.string().trim().min(1).max(160),
  amountMinor: minor.positive(),
  dueDate: isoDate.nullish(),
  note: z.string().max(500).nullish(),
  settled: z.boolean().default(false),
  settledOn: isoDate.nullish(),
  // null = one-off. When set, the server auto-creates the next occurrence once
  // its due date arrives (regardless of whether this one is settled). `seriesId`
  // links occurrences and is server-managed, so it isn't accepted here.
  recurrence: enumOf(RECURRENCE_FREQUENCIES).nullish(),
});
export const payReceiveCreateSchema = payReceiveBase.superRefine((d, ctx) => {
  if (d.recurrence && !d.dueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dueDate'],
      message: 'a recurring item needs a due date to anchor the schedule',
    });
  }
});
export const payReceiveUpdateSchema = payReceiveBase.partial();

// ── Settings + profile + dashboard ───────────────────────────────────────────
export const settingsUpdateSchema = z.object({
  currency: z.string().length(3).optional(),
  monthStart: z.string().max(16).optional(),
  rollover: z.boolean().optional(),
  tagBehavior: enumOf(BUDGET_MODES).optional(),
  privacyMask: z.boolean().optional(),
  twoFactor: z.boolean().optional(),
  loginAlerts: z.boolean().optional(),
  biometric: z.boolean().optional(),
  weeklyEmail: z.boolean().optional(),
  onboarded: z.boolean().optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().max(40).nullish(),
  timezone: z.string().max(80).nullish(),
  avatarUploadId: uuid.nullish(),
});

export const dashboardSchema = z.object({
  widgetIds: z.array(z.string().max(40)),
});
