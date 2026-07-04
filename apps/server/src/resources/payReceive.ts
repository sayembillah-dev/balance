import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { payReceiveCreateSchema, payReceiveUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { payReceive } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';
import { catchUpPayReceive } from '../lib/recurrence.js';

export const payReceiveRouter: Router = Router();

payReceiveRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  // Spawn any recurring occurrences that have come due before listing.
  // Best-effort: a catch-up failure must never block the read.
  try {
    await catchUpPayReceive(userId);
  } catch (err) {
    console.error('[pay-receive] recurrence catch-up failed', err);
  }
  const rows = await db
    .select()
    .from(payReceive)
    .where(owned(payReceive, userId))
    .orderBy(asc(payReceive.dueDate));
  res.json(rows);
});

payReceiveRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = payReceiveCreateSchema.parse(req.body);
  const [row] = await db.insert(payReceive).values({ ...input, userId }).returning();
  res.status(201).json(row);
});

payReceiveRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = payReceiveUpdateSchema.parse(req.body);
  const [row] = await db
    .update(payReceive)
    .set(input)
    .where(and(owned(payReceive, userId), eq(payReceive.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Item not found');
  res.json(row);
});

payReceiveRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(payReceive)
    .set(softDeleteSet())
    .where(and(owned(payReceive, userId), eq(payReceive.id, req.params.id)))
    .returning({ id: payReceive.id });
  if (!row) throw notFound('Item not found');
  res.status(204).end();
});
