import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { profileUpdateSchema, settingsUpdateSchema, dashboardSchema } from '@balance/shared';
import { db } from '../db/client.js';
import { users, settings, dashboardLayouts } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { notFound } from '../lib/errors.js';

export const meRouter: Router = Router();

const PROFILE_COLUMNS = {
  id: users.id, email: users.email, name: users.name,
  phone: users.phone, timezone: users.timezone, role: users.role,
} as const;

// Current user's profile. Also used to restore session state after a reload
// (refresh cookie → access token → /me).
meRouter.get('/', async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, authedUserId(req)),
    columns: { id: true, email: true, name: true, phone: true, timezone: true, role: true },
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
