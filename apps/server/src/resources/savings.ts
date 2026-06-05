import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { savingsPoolSchema, goalCreateSchema, goalUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { savings, savingsGoals } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';

export const savingsRouter: Router = Router();

// GET / — the pool plus all goals (the shape the Savings page works with).
savingsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const pool = await db.query.savings.findFirst({ where: eq(savings.userId, userId) });
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(owned(savingsGoals, userId))
    .orderBy(asc(savingsGoals.createdAt));
  res.json({ poolMinor: pool?.poolMinor ?? 0, goals });
});

// PATCH / — update the savings pool total (singleton row, created at signup).
savingsRouter.patch('/', async (req, res) => {
  const userId = authedUserId(req);
  const { poolMinor } = savingsPoolSchema.parse(req.body);
  await db
    .insert(savings)
    .values({ userId, poolMinor })
    .onConflictDoUpdate({ target: savings.userId, set: { poolMinor, updatedAt: new Date() } });
  res.json({ poolMinor });
});

savingsRouter.post('/goals', async (req, res) => {
  const userId = authedUserId(req);
  const input = goalCreateSchema.parse(req.body);
  const [row] = await db.insert(savingsGoals).values({ ...input, userId }).returning();
  res.status(201).json(row);
});

savingsRouter.patch('/goals/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = goalUpdateSchema.parse(req.body);
  const [row] = await db
    .update(savingsGoals)
    .set(input)
    .where(and(owned(savingsGoals, userId), eq(savingsGoals.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Goal not found');
  res.json(row);
});

savingsRouter.delete('/goals/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(savingsGoals)
    .set(softDeleteSet())
    .where(and(owned(savingsGoals, userId), eq(savingsGoals.id, req.params.id)))
    .returning({ id: savingsGoals.id });
  if (!row) throw notFound('Goal not found');
  res.status(204).end();
});
