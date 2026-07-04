import { and, eq, gte, lt, isNull, isNotNull, sql } from 'drizzle-orm';
import type { RecurrenceFrequency } from '@balance/shared';
import { db } from '../db/client.js';
import {
  budgets,
  budgetPeriods,
  payReceive,
  transactions,
  transactionTags,
  users,
} from '../db/schema/index.js';
import { owned } from './tenancy.js';

/**
 * Recurrence engine — runs lazily on read (no scheduler exists in this deploy).
 * On each GET of budgets / pay-receive we "catch up" any occurrences that have
 * come due since the last read. Every step is idempotent: once caught up, the
 * next boundary is in the future and the loops do nothing, so repeat reads and
 * server restarts are safe.
 *
 * All date math is on wall-clock YYYY-MM-DD strings (matching how the app stores
 * dates) and pinned to UTC internally so it never shifts across a DST edge.
 */

// A hard ceiling on catch-up iterations, so a bad anchor can never spin forever.
const MAX_STEPS = 520; // ~10 years of weeks

// ── wall-clock date helpers ──────────────────────────────────────────────────
const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-');
  return [Number(y), Number(m), Number(d)];
};
const toUTC = (iso: string): Date => {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (dt: Date): string => dt.toISOString().slice(0, 10);
const pad = (n: number): string => String(n).padStart(2, '0');

const addDays = (iso: string, n: number): string => {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmt(dt);
};
/** Add calendar months, clamping the day to the target month's last day
 *  (e.g. Jan 31 + 1 month → Feb 28/29). */
const addMonths = (iso: string, n: number): string => {
  const [y, m, d] = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12; // 0-based month
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, lastDay))}`;
};
/** Monday of the week containing `iso` — matches the web's Weekly period start. */
const mondayOf = (iso: string): string => {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); // Mon=0 … Sun=6
  return fmt(dt);
};

/** Today's calendar date (YYYY-MM-DD) in the user's timezone, matching the web's
 *  `today()`. Falls back to UTC when the zone is missing or invalid. */
function todayInTz(tz?: string | null): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

async function userTimezone(userId: string): Promise<string | null> {
  const [u] = await db
    .select({ tz: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.tz ?? null;
}

// ── budget period math (mirrors web/src/lib/bal.js budgetPeriodStart) ─────────
/** The calendar start of the period that `today` falls in, for a timeframe. */
export function budgetPeriodStartFor(today: string, timeframe: string): string {
  if (timeframe === 'Yearly') return `${today.slice(0, 4)}-01-01`;
  if (timeframe === 'Weekly') return mondayOf(today);
  return `${today.slice(0, 7)}-01`; // Monthly (default)
}
/** The start of the period following the one beginning at `periodStart`. */
function budgetNextPeriodStart(periodStart: string, timeframe: string): string {
  if (timeframe === 'Yearly') return addMonths(periodStart, 12);
  if (timeframe === 'Weekly') return addDays(periodStart, 7);
  return addMonths(periodStart, 1); // Monthly
}

const nextOccurrence = (due: string, freq: RecurrenceFrequency): string =>
  freq === 'weekly' ? addDays(due, 7) : addMonths(due, 1);

// ── spend for a budget within an elapsed period [start, end) ─────────────────
async function spentForBudget(
  b: { userId: string; track: string; categoryId: string | null; tagId: string | null },
  start: string,
  end: string,
): Promise<number> {
  const total = sql<string>`coalesce(sum(${transactions.amountMinor}), 0)`;
  const window = and(
    eq(transactions.userId, b.userId),
    eq(transactions.type, 'expense'),
    gte(transactions.date, start),
    lt(transactions.date, end),
    isNull(transactions.deletedAt),
  );

  if (b.track === 'tag') {
    if (!b.tagId) return 0;
    const [row] = await db
      .select({ total })
      .from(transactions)
      .innerJoin(transactionTags, eq(transactionTags.transactionId, transactions.id))
      .where(and(window, eq(transactionTags.tagId, b.tagId)));
    return Number(row?.total ?? 0);
  }

  if (!b.categoryId) return 0;
  const [row] = await db
    .select({ total })
    .from(transactions)
    .where(and(window, eq(transactions.categoryId, b.categoryId)));
  return Number(row?.total ?? 0);
}

/**
 * Archive every fully-elapsed period of the user's recurring budgets and advance
 * each budget's live `periodStart` to the current period. Newly-recurring budgets
 * with no anchor yet are simply anchored to the current period (no back-fill).
 */
export async function catchUpBudgets(userId: string): Promise<void> {
  const today = todayInTz(await userTimezone(userId));
  const rows = await db
    .select()
    .from(budgets)
    .where(and(owned(budgets, userId), eq(budgets.recurring, true)));

  for (const b of rows) {
    // Anchor a freshly-recurring budget to the period it's currently in.
    if (!b.periodStart) {
      const ps = budgetPeriodStartFor(today, b.timeframe);
      await db.update(budgets).set({ periodStart: ps }).where(eq(budgets.id, b.id));
      continue;
    }

    let ps = b.periodStart;
    let pe = budgetNextPeriodStart(ps, b.timeframe);
    let steps = 0;
    let advanced = false;

    // A period is closed once its end is on/before today; snapshot it, then move on.
    while (pe <= today && steps < MAX_STEPS) {
      const spent = await spentForBudget(b, ps, pe);
      await db
        .insert(budgetPeriods)
        .values({
          userId,
          budgetId: b.id,
          periodStart: ps,
          periodEnd: pe,
          capMinor: b.amountMinor,
          spentMinor: spent,
        })
        .onConflictDoNothing({
          target: [budgetPeriods.budgetId, budgetPeriods.periodStart],
        });
      ps = pe;
      pe = budgetNextPeriodStart(ps, b.timeframe);
      advanced = true;
      steps += 1;
    }

    if (advanced) {
      await db.update(budgets).set({ periodStart: ps }).where(eq(budgets.id, b.id));
    }
  }
}

/**
 * For each recurring pay/receive series, create any occurrences whose due date
 * has arrived. The newest occurrence is the sole "spawner" (carries the
 * `recurrence` value); older ones have it cleared, so the series never
 * double-spawns. Occurrences are created regardless of settle status.
 */
export async function catchUpPayReceive(userId: string): Promise<void> {
  const today = todayInTz(await userTimezone(userId));
  const spawners = await db
    .select()
    .from(payReceive)
    .where(and(owned(payReceive, userId), isNotNull(payReceive.recurrence)));

  for (const head of spawners) {
    if (!head.recurrence || !head.dueDate) continue;
    const freq = head.recurrence;
    const seriesId = head.seriesId ?? head.id;

    // Ensure the head belongs to the series (so the UI can group occurrences).
    if (!head.seriesId) {
      await db.update(payReceive).set({ seriesId }).where(eq(payReceive.id, head.id));
    }

    let prevId = head.id;
    let due = head.dueDate;
    let next = nextOccurrence(due, freq);
    let steps = 0;

    while (next <= today && steps < MAX_STEPS) {
      const [created] = await db
        .insert(payReceive)
        .values({
          userId,
          kind: head.kind,
          party: head.party,
          amountMinor: head.amountMinor,
          dueDate: next,
          note: head.note,
          settled: false,
          recurrence: freq,
          seriesId,
        })
        .returning({ id: payReceive.id });
      if (!created) break;
      // The previous spawner hands the baton to the new occurrence.
      await db
        .update(payReceive)
        .set({ recurrence: null })
        .where(eq(payReceive.id, prevId));

      prevId = created.id;
      due = next;
      next = nextOccurrence(due, freq);
      steps += 1;
    }
  }
}
