import { Router } from 'express';
import { and, asc, eq, or } from 'drizzle-orm';
import { categoryCreateSchema, categoryUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { categories } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound, conflict } from '../lib/errors.js';

export const categoriesRouter: Router = Router();

// GET / — the full category tree: top-level categories each with a `subs` array.
categoriesRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(categories)
    .where(owned(categories, userId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const childrenOf = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.parentId) continue;
    const bucket = childrenOf.get(r.parentId) ?? [];
    bucket.push(r);
    childrenOf.set(r.parentId, bucket);
  }
  const tree = rows
    .filter((r) => !r.parentId)
    .map((r) => ({ ...r, subs: childrenOf.get(r.id) ?? [] }));
  res.json(tree);
});

categoriesRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = categoryCreateSchema.parse(req.body);

  // A subcategory inherits its parent's kind and must reference an owned parent.
  let kind = input.kind;
  if (input.parentId) {
    const parent = await db.query.categories.findFirst({
      where: and(owned(categories, userId), eq(categories.id, input.parentId)),
    });
    if (!parent) throw notFound('Parent category not found');
    if (parent.parentId) throw conflict('Categories nest only one level deep');
    kind = parent.kind;
  }

  const [row] = await db
    .insert(categories)
    .values({ ...input, kind, userId })
    .returning();
  res.status(201).json(row);
});

categoriesRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = categoryUpdateSchema.parse(req.body);
  const [row] = await db
    .update(categories)
    .set(input)
    .where(and(owned(categories, userId), eq(categories.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Category not found');
  res.json(row);
});

// DELETE soft-deletes the category and any subcategories under it.
categoriesRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const id = req.params.id;
  const rows = await db
    .update(categories)
    .set(softDeleteSet())
    .where(
      and(
        owned(categories, userId),
        or(eq(categories.id, id), eq(categories.parentId, id)),
      ),
    )
    .returning({ id: categories.id });
  if (rows.length === 0) throw notFound('Category not found');
  res.status(204).end();
});
