import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { presetCreateSchema, presetUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import {
  presets, presetTags, accounts, categories, tags,
} from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';
import { assertOwnedIds } from './_ownership.js';

export const presetsRouter: Router = Router();

type PresetRow = typeof presets.$inferSelect;

async function attachTags(rows: PresetRow[]): Promise<(PresetRow & { tags: string[] })[]> {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(presetTags)
    .where(inArray(presetTags.presetId, rows.map((r) => r.id)));
  const byPreset = new Map<string, string[]>();
  for (const l of links) {
    const arr = byPreset.get(l.presetId) ?? [];
    arr.push(l.tagId);
    byPreset.set(l.presetId, arr);
  }
  return rows.map((r) => ({ ...r, tags: byPreset.get(r.id) ?? [] }));
}

async function assertRefsOwned(
  userId: string,
  d: { accountId?: string | null; categoryId?: string | null; subcategoryId?: string | null; tags?: string[] },
) {
  await assertOwnedIds(accounts, [d.accountId], userId, 'Account');
  await assertOwnedIds(categories, [d.categoryId, d.subcategoryId], userId, 'Category');
  await assertOwnedIds(tags, d.tags ?? [], userId, 'Tag');
}

presetsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(presets)
    .where(owned(presets, userId))
    .orderBy(asc(presets.name));
  res.json(await attachTags(rows));
});

presetsRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = presetCreateSchema.parse(req.body);
  await assertRefsOwned(userId, input);
  const { tags: tagIds, ...fields } = input;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(presets).values({ ...fields, userId }).returning();
    if (tagIds.length) {
      await tx.insert(presetTags).values(tagIds.map((tagId) => ({ presetId: row!.id, tagId })));
    }
    return row!;
  });
  res.status(201).json({ ...created, tags: tagIds });
});

presetsRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = presetUpdateSchema.parse(req.body);
  await assertRefsOwned(userId, input);
  const { tags: tagIds, ...fields } = input;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(presets)
      .set(fields)
      .where(and(owned(presets, userId), eq(presets.id, req.params.id)))
      .returning();
    if (!row) return null;
    if (tagIds) {
      await tx.delete(presetTags).where(eq(presetTags.presetId, row.id));
      if (tagIds.length) {
        await tx.insert(presetTags).values(tagIds.map((tagId) => ({ presetId: row.id, tagId })));
      }
    }
    return row;
  });
  if (!updated) throw notFound('Preset not found');
  const [withTags] = await attachTags([updated]);
  res.json(withTags);
});

presetsRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(presets)
    .set(softDeleteSet())
    .where(and(owned(presets, userId), eq(presets.id, req.params.id)))
    .returning({ id: presets.id });
  if (!row) throw notFound('Preset not found');
  res.status(204).end();
});
