import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Single .env lives at the monorepo root. In Docker, config comes from the
// process environment instead and the file simply won't be found (that's fine —
// dotenv never overrides already-set vars).
config({ path: resolve(import.meta.dirname, '../../../../.env') });

/**
 * Environment is validated once at boot. Missing/invalid required vars cause a
 * fast, readable exit rather than a confusing runtime failure later.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  JWT_SECRET: z.string().min(16).optional(),
  DATA_DIR: z.string().default('./data'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Marks the refresh cookie `Secure`. Must be false when serving over plain
  // HTTP (browsers drop Secure cookies on http://), true behind HTTPS/a TLS
  // proxy. Explicit string parse so the literal "false" is honoured.
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
