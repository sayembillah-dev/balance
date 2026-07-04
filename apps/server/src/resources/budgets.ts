import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { budgetCreateSchema, budgetUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { budgets, budgetPeriods, categories, tags } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';
import { catchUpBudgets } from '../lib/recurrence.js';
import { assertOwnedIds } from './_ownership.js';

export const budgetsRouter: Router = Router();

async function assertRefs(userId: string, d: { categoryId?: string | null; tagId?: string | null }) {
  await assertOwnedIds(categories, [d.categoryId], userId, 'Category');
  await assertOwnedIds(tags, [d.tagId], userId, 'Tag');
}

budgetsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  // Roll any recurring budgets forward and archive elapsed periods before listing.
  // A catch-up failure must never block the read, so it's best-effort.
  try {
    await catchUpBudgets(userId);
  } catch (err) {
    console.error('[budgets] recurrence catch-up failed', err);
  }
  const rows = await db.select().from(budgets).where(owned(budgets, userId)).orderBy(asc(budgets.name));
  res.json(rows);
});

// Archived history for one recurring budget (most recent period first).
budgetsRouter.get('/:id/periods', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(budgetPeriods)
    .where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.budgetId, req.params.id)))
    .orderBy(desc(budgetPeriods.periodStart));
  res.json(rows);
});

budgetsRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = budgetCreateSchema.parse(req.body);
  await assertRefs(userId, input);
  const [row] = await db.insert(budgets).values({ ...input, userId }).returning();
  res.status(201).json(row);
});

budgetsRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = budgetUpdateSchema.parse(req.body);
  await assertRefs(userId, input);
  const [row] = await db
    .update(budgets)
    .set(input)
    .where(and(owned(budgets, userId), eq(budgets.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Budget not found');
  res.json(row);
});

budgetsRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(budgets)
    .set(softDeleteSet())
    .where(and(owned(budgets, userId), eq(budgets.id, req.params.id)))
    .returning({ id: budgets.id });
  if (!row) throw notFound('Budget not found');
  res.status(204).end();
});
