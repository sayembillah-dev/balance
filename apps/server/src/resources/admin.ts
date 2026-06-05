import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import {
  adminUserUpdateSchema,
  adminSetPasswordSchema,
  invitationCreateSchema,
  adminSettingsSchema,
} from '@balance/shared';
import { db } from '../db/client.js';
import { users, invitations, refreshTokens } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { hashPassword } from '../auth/passwords.js';
import { getAppSetting, setAppSetting } from '../lib/appSettings.js';
import { notFound, forbidden } from '../lib/errors.js';

export const adminRouter: Router = Router();

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// ── Users ────────────────────────────────────────────────────────────────────
adminRouter.get('/users', async (_req, res) => {
  const rows = await db
    .select({
      id: users.id, email: users.email, name: users.name, role: users.role,
      isActive: users.isActive, createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  res.json(rows.map((u) => ({ ...u, isActive: u.isActive === 1 })));
});

adminRouter.patch('/users/:id', async (req, res) => {
  const meId = authedUserId(req);
  const id = req.params.id;
  if (id === meId) throw forbidden("You can't change your own role or status");
  const input = adminUserUpdateSchema.parse(req.body);
  const patch: Record<string, unknown> = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.isActive !== undefined) patch.isActive = input.isActive ? 1 : 0;
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning({
    id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive,
  });
  if (!row) throw notFound('User not found');
  res.json({ ...row, isActive: row.isActive === 1 });
});

adminRouter.delete('/users/:id', async (req, res) => {
  const meId = authedUserId(req);
  if (req.params.id === meId) throw forbidden("You can't delete your own account");
  const [row] = await db.delete(users).where(eq(users.id, req.params.id)).returning({ id: users.id });
  if (!row) throw notFound('User not found');
  res.status(204).end();
});

// Force-logout everywhere by bumping token_version + revoking refresh tokens.
adminRouter.post('/users/:id/logout', async (req, res) => {
  const id = req.params.id;
  const [row] = await db
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!row) throw notFound('User not found');
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, id));
  res.json({ ok: true });
});

adminRouter.post('/users/:id/set-password', async (req, res) => {
  const id = req.params.id;
  const { password } = adminSetPasswordSchema.parse(req.body);
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .update(users)
    .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!row) throw notFound('User not found');
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, id));
  res.json({ ok: true });
});

// ── Invitations ──────────────────────────────────────────────────────────────
adminRouter.get('/invitations', async (_req, res) => {
  const rows = await db
    .select({
      id: invitations.id, email: invitations.email, role: invitations.role,
      expiresAt: invitations.expiresAt, acceptedAt: invitations.acceptedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt));
  res.json(rows);
});

adminRouter.post('/invitations', async (req, res) => {
  const meId = authedUserId(req);
  const input = invitationCreateSchema.parse(req.body);
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(invitations)
    .values({
      email: input.email ?? null,
      tokenHash: sha256(token),
      role: input.role,
      createdById: meId,
      expiresAt,
    })
    .returning({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt });
  // The token is shown only once; the link is built on the client from origin.
  res.status(201).json({ invitation: row, token, invitePath: `/auth?invite=${token}` });
});

adminRouter.delete('/invitations/:id', async (req, res) => {
  const [row] = await db.delete(invitations).where(eq(invitations.id, req.params.id)).returning({ id: invitations.id });
  if (!row) throw notFound('Invitation not found');
  res.status(204).end();
});

// ── Instance settings ────────────────────────────────────────────────────────
adminRouter.get('/settings', async (_req, res) => {
  res.json({
    allowOpenSignups: await getAppSetting('allow_open_signups'),
    instanceName: await getAppSetting('instance_name'),
  });
});

adminRouter.patch('/settings', async (req, res) => {
  const input = adminSettingsSchema.parse(req.body);
  if (input.allowOpenSignups !== undefined) await setAppSetting('allow_open_signups', input.allowOpenSignups);
  if (input.instanceName !== undefined) await setAppSetting('instance_name', input.instanceName);
  res.json({
    allowOpenSignups: await getAppSetting('allow_open_signups'),
    instanceName: await getAppSetting('instance_name'),
  });
});
