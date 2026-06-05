import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { tagCreateSchema, tagUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { tags } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';

export const tagsRouter: Router = Router();

tagsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(tags)
    .where(owned(tags, userId))
    .orderBy(asc(tags.name));
  res.json(rows);
});

tagsRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = tagCreateSchema.parse(req.body);
  const [row] = await db.insert(tags).values({ ...input, userId }).returning();
  res.status(201).json(row);
});

tagsRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = tagUpdateSchema.parse(req.body);
  const [row] = await db
    .update(tags)
    .set(input)
    .where(and(owned(tags, userId), eq(tags.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Tag not found');
  res.json(row);
});

tagsRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(tags)
    .set(softDeleteSet())
    .where(and(owned(tags, userId), eq(tags.id, req.params.id)))
    .returning({ id: tags.id });
  if (!row) throw notFound('Tag not found');
  res.status(204).end();
});
