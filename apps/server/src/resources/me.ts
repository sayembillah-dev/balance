import { Router } from 'express';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  profileUpdateSchema, settingsUpdateSchema, dashboardSchema, changePasswordSchema,
  aiSettingsUpdateSchema, aiSettingsTestSchema, aiModelsRequestSchema,
  aiModelCreateSchema, aiModelUpdateSchema,
  type AiProviderType,
} from '@balance/shared';
import { db } from '../db/client.js';
import { users, settings, dashboardLayouts, refreshTokens, aiSettings, aiModels } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { notFound, unauthorized, forbidden } from '../lib/errors.js';
import { testAiConnection } from '../lib/ai-probe.js';
import { fetchModels } from '../lib/ai-models.js';
import { completeAi } from '../lib/ai-complete.js';

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

// ── AI settings ───────────────────────────────────────────────────────────────

/**
 * Mask secret-looking credential values before sending to the client.
 * Shows the last 4 chars so the user knows which key is saved without exposing it.
 */
function maskCredentials(raw: Record<string, string>): Record<string, string> {
  const SECRET_KEYS = /apikey|token|secret|password|private|json/i;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      SECRET_KEYS.test(k) && v.length > 4 ? `••••${v.slice(-4)}` : v,
    ]),
  );
}

meRouter.get('/ai-settings', async (req, res) => {
  const userId = authedUserId(req);
  const row = await db.query.aiSettings.findFirst({ where: eq(aiSettings.userId, userId) });
  if (!row) return res.json({ enabled: false, activeModelId: null });
  res.json({ enabled: row.enabled, activeModelId: row.activeModelId ?? null });
});

meRouter.patch('/ai-settings', async (req, res) => {
  const userId = authedUserId(req);
  const input = aiSettingsUpdateSchema.parse(req.body);

  const enabledSet = input.enabled !== undefined ? { enabled: input.enabled } : {};
  const activeModelSet = input.activeModelId !== undefined ? { activeModelId: input.activeModelId } : {};

  const [row] = await db
    .insert(aiSettings)
    .values({
      userId,
      enabled: input.enabled ?? false,
      activeModelId: input.activeModelId ?? null,
    })
    .onConflictDoUpdate({
      target: aiSettings.userId,
      set: { ...enabledSet, ...activeModelSet, updatedAt: new Date() },
    })
    .returning();

  res.json({ enabled: row?.enabled ?? false, activeModelId: row?.activeModelId ?? null });
});

// Test credentials without saving (does not touch the database)
meRouter.post('/ai-settings/test', async (req, res) => {
  const { provider, credentials } = aiSettingsTestSchema.parse(req.body);
  const result = await testAiConnection(provider as AiProviderType, credentials);
  res.json(result);
});

// Fetch available models for a provider using provided credentials (used from the add/edit modal)
meRouter.post('/ai-settings/models', async (req, res) => {
  const { provider, credentials: provided } = aiModelsRequestSchema.parse(req.body);
  const merged = provided ?? {};
  try {
    const models = await fetchModels(provider as AiProviderType, merged);
    res.json({ models });
  } catch (err) {
    res.json({ models: [], error: err instanceof Error ? err.message : String(err) });
  }
});

// ── AI models CRUD ────────────────────────────────────────────────────────────

meRouter.get('/ai-models', async (req, res) => {
  const userId = authedUserId(req);
  const rows = await db.query.aiModels.findMany({
    where: eq(aiModels.userId, userId),
    orderBy: [aiModels.createdAt],
  });
  res.json({
    models: rows.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      credentials: maskCredentials(JSON.parse(m.encryptedCredentials)),
    })),
  });
});

meRouter.post('/ai-models', async (req, res) => {
  const userId = authedUserId(req);
  const input = aiModelCreateSchema.parse(req.body);
  const [model] = await db
    .insert(aiModels)
    .values({
      userId,
      name: input.name,
      provider: input.provider,
      encryptedCredentials: JSON.stringify(input.credentials),
    })
    .returning();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  res.status(201).json({ id: model!.id, name: model!.name, provider: model!.provider });
});

meRouter.patch('/ai-models/:id', async (req, res) => {
  const userId = authedUserId(req);
  const { id } = req.params;
  const input = aiModelUpdateSchema.parse(req.body);

  const existing = await db.query.aiModels.findFirst({
    where: and(eq(aiModels.id, id), eq(aiModels.userId, userId)),
  });
  if (!existing) throw notFound('Model not found');

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.provider !== undefined) updates.provider = input.provider;
  if (input.credentials && Object.keys(input.credentials).length > 0) {
    const merged = { ...JSON.parse(existing.encryptedCredentials), ...input.credentials };
    updates.encryptedCredentials = JSON.stringify(merged);
  }

  await db.update(aiModels).set(updates).where(and(eq(aiModels.id, id), eq(aiModels.userId, userId)));
  res.json({ ok: true });
});

meRouter.delete('/ai-models/:id', async (req, res) => {
  const userId = authedUserId(req);
  const { id } = req.params;
  await db.delete(aiModels).where(and(eq(aiModels.id, id), eq(aiModels.userId, userId)));
  // Clear active_model_id if it pointed to the deleted model
  await db
    .update(aiSettings)
    .set({ activeModelId: null, updatedAt: new Date() })
    .where(and(eq(aiSettings.userId, userId), eq(aiSettings.activeModelId, id)));
  res.json({ ok: true });
});

// ── AI chat completion ────────────────────────────────────────────────────────

meRouter.post('/ai-chat', async (req, res) => {
  const userId = authedUserId(req);
  const { prompt } = z.object({ prompt: z.string().min(1).max(50_000) }).parse(req.body);

  const aiRow = await db.query.aiSettings.findFirst({ where: eq(aiSettings.userId, userId) });
  if (!aiRow?.enabled) {
    return res.status(400).json({ error: 'AI is not enabled. Turn it on in Settings → AI Assistant.' });
  }
  if (!aiRow.activeModelId) {
    return res.status(400).json({ error: 'No AI model selected. Go to Settings → AI Assistant to choose one.' });
  }

  const modelRow = await db.query.aiModels.findFirst({
    where: and(eq(aiModels.id, aiRow.activeModelId), eq(aiModels.userId, userId)),
  });
  if (!modelRow) {
    return res.status(400).json({ error: 'Selected AI model not found. Re-select a model in Settings → AI Assistant.' });
  }

  let creds: Record<string, string> = {};
  try { creds = JSON.parse(modelRow.encryptedCredentials); } catch { /* use empty */ }

  try {
    const text = await completeAi(modelRow.provider as AiProviderType, creds, prompt);
    res.json({ text: text || '' });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'AI request failed' });
  }
});
