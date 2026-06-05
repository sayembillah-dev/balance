import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import {
  profileUpdateSchema, settingsUpdateSchema, dashboardSchema, changePasswordSchema,
} from '@balance/shared';
import { db } from '../db/client.js';
import { users, settings, dashboardLayouts, refreshTokens } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { notFound, unauthorized, forbidden } from '../lib/errors.js';

export const meRouter: Router = Router();

const PROFILE_COLUMNS = {
  id: users.id, email: users.email, name: users.name,
  phone: users.phone, timezone: users.timezone, role: users.role,
  avatarUploadId: users.avatarUploadId,
} as const;

// Current user's profile. Also used to restore session state after a reload
// (refresh cookie → access token → /me).
meRouter.get('/', async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, authedUserId(req)),
    columns: { id: true, email: true, name: true, phone: true, timezone: true, role: true, avatarUploadId: true },
  });
  if (!user) throw notFound('User not found');
  res.json(user);
});

meRouter.patch('/', async (req, res) => {
  const userId = authedUserId(req);
  const input = profileUpdateSchema.parse(req.body);
  const [row] = await db.update(users).set(input).where(eq(users.id, userId)).returning(PROFILE_COLUMNS);
  res.json(row);
});

// Change own password: verify current, set new, then invalidate every session
// (bump token_version + revoke refresh tokens). The client signs back in after.
meRouter.post('/password', async (req, res) => {
  const userId = authedUserId(req);
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound('User not found');
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw unauthorized('Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.id, userId));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId));
  });
  res.json({ ok: true });
});

// Sign out of every device (bump token_version + revoke all refresh tokens).
meRouter.post('/logout-all', async (req, res) => {
  const userId = authedUserId(req);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.id, userId));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId));
  });
  res.json({ ok: true });
});

// Delete own account (cascades all data). Block if it would orphan a multi-user
// instance by removing its only admin.
meRouter.delete('/', async (req, res) => {
  const userId = authedUserId(req);
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { role: true } });
  if (me?.role === 'admin') {
    const adminRows = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'admin'));
    const totalRows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    const admins = adminRows[0]?.n ?? 0;
    const total = totalRows[0]?.n ?? 0;
    if (admins === 1 && total > 1) {
      throw forbidden('Promote another user to admin before deleting your account.');
    }
  }
  await db.delete(users).where(eq(users.id, userId));
  res.status(204).end();
});

// Per-user preferences singleton (created at signup).
meRouter.get('/settings', async (req, res) => {
  const userId = authedUserId(req);
  const row = await db.query.settings.findFirst({ where: eq(settings.userId, userId) });
  res.json(row ?? {});
});

meRouter.patch('/settings', async (req, res) => {
  const userId = authedUserId(req);
  const input = settingsUpdateSchema.parse(req.body);
  const [row] = await db
    .insert(settings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: settings.userId, set: { ...input, updatedAt: new Date() } })
    .returning();
  res.json(row);
});

// Dashboard widget order.
meRouter.get('/dashboard', async (req, res) => {
  const userId = authedUserId(req);
  const row = await db.query.dashboardLayouts.findFirst({ where: eq(dashboardLayouts.userId, userId) });
  res.json({ widgetIds: row?.widgetIds ?? [] });
});

meRouter.put('/dashboard', async (req, res) => {
  const userId = authedUserId(req);
  const { widgetIds } = dashboardSchema.parse(req.body);
  await db
    .insert(dashboardLayouts)
    .values({ userId, widgetIds })
    .onConflictDoUpdate({ target: dashboardLayouts.userId, set: { widgetIds, updatedAt: new Date() } });
  res.json({ widgetIds });
});
