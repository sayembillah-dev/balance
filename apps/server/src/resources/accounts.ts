import { Router } from 'express';
import { and, asc, eq, sql } from 'drizzle-orm';
import { accountCreateSchema, accountUpdateSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { accounts } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { owned, softDeleteSet } from '../lib/tenancy.js';
import { notFound } from '../lib/errors.js';

export const accountsRouter: Router = Router();

/**
 * Computes each account's signed balance delta from its transactions: income in,
 * expense out, transfers in/out. Balance is opening + delta — never stored, so
 * it can't drift from the ledger. Matches the mockup's Accounts.jsx formula.
 */
async function balanceDeltas(userId: string): Promise<Map<string, number>> {
  const rows = await db.execute<{ id: string; delta: string }>(sql`
    select a.id,
      coalesce(sum(
        case
          when t.type = 'income'   and t.account_id      = a.id then  t.amount_minor
          when t.type = 'expense'  and t.account_id      = a.id then -t.amount_minor
          when t.type = 'transfer' and t.to_account_id   = a.id then  t.amount_minor
          when t.type = 'transfer' and t.from_account_id = a.id then -t.amount_minor
          else 0
        end), 0) as delta
    from ${accounts} a
    left join transactions t
      on t.user_id = a.user_id and t.deleted_at is null
     and (t.account_id = a.id or t.from_account_id = a.id or t.to_account_id = a.id)
    where a.user_id = ${userId} and a.deleted_at is null
    group by a.id
  `);
  return new Map(rows.rows.map((r) => [r.id, Number(r.delta)]));
}

accountsRouter.get('/', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db
    .select()
    .from(accounts)
    .where(owned(accounts, userId))
    .orderBy(asc(accounts.createdAt));

  if (req.query.withBalances !== 'true') {
    res.json(rows);
    return;
  }
  const deltas = await balanceDeltas(userId);
  res.json(
    rows.map((a) => ({
      ...a,
      balanceMinor: a.openingMinor + (deltas.get(a.id) ?? 0),
    })),
  );
});

accountsRouter.post('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = accountCreateSchema.parse(req.body);
  const [row] = await db.insert(accounts).values({ ...input, userId }).returning();
  res.status(201).json(row);
});

accountsRouter.patch('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const input = accountUpdateSchema.parse(req.body);
  const [row] = await db
    .update(accounts)
    .set(input)
    .where(and(owned(accounts, userId), eq(accounts.id, req.params.id)))
    .returning();
  if (!row) throw notFound('Account not found');
  res.json(row);
});

accountsRouter.delete('/:id', async (req, res) => {
  const userId = authedUserId(req);
  const [row] = await db
    .update(accounts)
    .set(softDeleteSet())
    .where(and(owned(accounts, userId), eq(accounts.id, req.params.id)))
    .returning({ id: accounts.id });
  if (!row) throw notFound('Account not found');
  res.status(204).end();
});
