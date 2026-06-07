import { z } from 'zod';
import { AI_PROVIDERS } from '../enums.js';

const enumOf = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.enum(vals as unknown as [T[number], ...T[number][]]);

// Credential map: field key → value (both strings; password fields have the same shape)
const credMap = z.record(z.string().max(64), z.string().max(20000));

// ── PATCH /me/ai-settings ────────────────────────────────────────────────────
export const aiSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  // UUID of the active ai_models row (null = deselect)
  activeModelId: z.string().uuid().nullable().optional(),
});

// ── POST /me/ai-settings/test ────────────────────────────────────────────────
export const aiSettingsTestSchema = z.object({
  provider: enumOf(AI_PROVIDERS),
  credentials: credMap,
});

// ── POST /me/ai-settings/models ──────────────────────────────────────────────
export const aiModelsRequestSchema = z.object({
  provider: enumOf(AI_PROVIDERS),
  // If omitted → server merges with stored credentials
  credentials: credMap.optional(),
});

// ── POST /me/ai-models ───────────────────────────────────────────────────────
export const aiModelCreateSchema = z.object({
  name: z.string().min(1).max(100),
  provider: enumOf(AI_PROVIDERS),
  credentials: credMap,
});

// ── PATCH /me/ai-models/:id ──────────────────────────────────────────────────
export const aiModelUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: enumOf(AI_PROVIDERS).optional(),
  credentials: credMap.optional(),
});
