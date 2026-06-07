import { z } from 'zod';
import { AI_PROVIDERS } from '../enums.js';

const enumOf = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.enum(vals as unknown as [T[number], ...T[number][]]);

// Credential map: field key → value (both strings; password fields have the same shape)
const credMap = z.record(z.string().max(64), z.string().max(20000));

// ── PATCH /me/ai-settings ────────────────────────────────────────────────────
export const aiSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  // null clears the provider selection
  provider: enumOf(AI_PROVIDERS).nullable().optional(),
  // If omitted or empty record → keep existing encrypted blob unchanged
  credentials: credMap.optional(),
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
