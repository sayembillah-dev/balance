import 'dotenv/config';
import { z } from 'zod';

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
