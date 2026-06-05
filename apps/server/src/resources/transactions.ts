import { Router } from 'express';
import {
  and, or, eq, gte, lte, ilike, inArray, asc, desc, sql, type SQL,
} from 'drizzle-orm';
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionQuerySchema,
} from '@balance/shared';
import { db } from '../db/client.js';
import {
  transactions, transactionTags, accounts, categories, tags,
} from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';
import { assertOwnedIds } from './_ownership.js';

export const transactionsRouter: Router = Router();

type TxRow = typeof transactions.$inferSelect;

const encodeCursor = (sortVal: string, id: string) =>
  Buffer.from(`${sortVal}|${id}`).toString('base64url');
const decodeCursor = (c: string) => {
  const [v, id] = Buffer.from(c, 'base64url').toString().split('|');
  return { v: v ?? '', id: id ?? '' };
};

/** Attaches the tag-id array to each transaction row. */
async function attachTags(rows: TxRow[]): Promise<(TxRow & { tags: string[] })[]> {
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(transactionTags)
    .where(inArray(transactionTags.transactionId, rows.map((r) => r.id)));
  const byTx = new Map<string, string[]>();
  for (const l of links) {
    const arr = byTx.get(l.transactionId) ?? [];
    arr.push(l.tagId);
    byTx.set(l.transactionId, arr);
  }
  return rows.map((r) => ({ ...r, tags: byTx.get(r.id) ?? [] }));
}

/** Zeroes out the fields that don't apply to a transaction's type, so the DB
 *  CHECK constraint is always satisfied regardless of what the client sent. */
function normalizeForType<T extends { type: string }>(input: T) {
  if (input.type === 'transfer') {
    return { ...input, accountId: null, categoryId: null, subcategoryId: null };
  }
  return { ...input, fromAccountId: null, toAccountId: null };
}

async function assertRefsOwned(
  userId: string,
  d: {
    accountId?: string | null; fromAccountId?: string | null;
    toAccountId?: string | null; categoryId?: string | null;
    subcategoryId?: string | null; tags?: string[];
  },
) {
  await assertOwnedIds(accounts, [d.accountId, d.fromAccountId, d.toAccountId], userId, 'Account');
  await assertOwnedIds(categories, [d.categoryId, d.subcategoryId], userId, 'Category');
  await assertOwnedIds(tags, d.tags ?? [], userId, 'Tag');
}

// GET / — filtered, keyset-paginated list. Returns { items, nextCursor }.
transactionsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const q = transactionQuerySchema.parse(req.query);

  const conds: SQL[] = [owned(transactions, userId)];
  if (q.type) conds.push(eq(transactions.type, q.type));
  if (q.mode) conds.push(eq(transactions.mode, q.mode));
  if (q.categoryId) conds.push(eq(transactions.categoryId, q.categoryId));
  if (q.accountId) {
    conds.push(
      or(
        eq(transactions.accountId, q.accountId),
        eq(transactions.fromAccountId, q.accountId),
        eq(transactions.toAccountId, q.accountId),
      )!,
    );
  }
  if (q.from) conds.push(gte(transactions.date, q.from));
  if (q.to) conds.push(lte(transactions.date, q.to));
  if (q.q) conds.push(ilike(transactions.merchant, `%${q.q}%`));
  if (q.tagId) {
    conds.push(
      inArray(
        transactions.id,
        db
          .select({ id: transactionTags.transactionId })
          .from(transactionTags)
          .where(eq(transactionTags.tagId, q.tagId)),
      ),
    );
  }

  // Keyset on (sortColumn, id) — stable under concurrent inserts, fast at depth.
  const col = q.sort === 'amount' ? transactions.amountMinor : transactions.date;
  if (q.cursor) {
    const { v, id } = decodeCursor(q.cursor);
    const cmp = q.sort === 'amount' ? sql`${Number(v)}::bigint` : sql`${v}::date`;
    const op = q.dir === 'desc' ? sql`<` : sql`>`;
    conds.push(sql`(${col}, ${transactions.id}) ${op} (${cmp}, ${id}::uuid)`);
  }

  const ord = q.dir === 'desc' ? desc : asc;
  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(ord(col), ord(transactions.id))
    .limit(q.limit + 1);

  let nextCursor: string | null = null;
  let page = rows;
  if (rows.length > q.limit) {
    page = rows.slice(0, q.limit);
    const last = page[page.length - 1]!;
    const sortVal = q.sort === 'amount' ? String(last.amountMinor) : last.date;
    nextCursor = encodeCursor(sortVal, last.id);
  }

  res.json({ items: await attachTags(page), nextCursor });
});

transactionsRouter.get('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const row = await db.query.transactions.findFirst({
    where: and(owned(transactions, userId), eq(transactions.id, req.params.id)),
  });
  if (!row) throw notFound('Transaction not found');
  const [withTags] = await attachTags([row]);
  res.json(withTags);
});

transactionsRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = transactionCreateSchema.parse(req.body);
  await assertRefsOwned(userId, input);
  const { tags: tagIds, ...fields } = normalizeForType(input);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(transactions)
      .values({ ...fields, userId })
      .returning();
    if (tagIds.length) {
      await tx.insert(transactionTags).values(
        tagIds.map((tagId) => ({ transactionId: row!.id, tagId })),
      );
    }
    return row!;
  });
  res.status(201).json({ ...created, tags: tagIds });
});

transactionsRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = transactionUpdateSchema.parse(req.body);
  await assertRefsOwned(userId, input);
  const { tags: tagIds, ...fields } = input;
  // If the type is changing, re-normalize the type-specific fields.
  const patch = fields.type ? normalizeForType({ ...fields, type: fields.type }) : fields;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(transactions)
      .set(patch)
      .where(and(owned(transactions, userId), eq(transactions.id, req.params.id)))
      .returning();
    if (!row) return null;
    if (tagIds) {
      await tx.delete(transactionTags).where(eq(transactionTags.transactionId, row.id));
      if (tagIds.length) {
        await tx.insert(transactionTags).values(
          tagIds.map((tagId) => ({ transactionId: row.id, tagId })),
        );
      }
    }
    return row;
  });
  if (!updated) throw notFound('Transaction not found');
  const [withTags] = await attachTags([updated]);
  res.json(withTags);
});

transactionsRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(transactions)
    .set(softDeleteSet())
    .where(and(owned(transactions, userId), eq(transactions.id, req.params.id)))
    .returning({ id: transactions.id });
  if (!row) throw notFound('Transaction not found');
  res.status(204).end();
});
