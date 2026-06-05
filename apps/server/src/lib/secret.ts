import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env.js';

/**
 * Resolves the JWT signing secret. Order of precedence:
 *   1. `JWT_SECRET` env var (set this to share a secret across replicas).
 *   2. A secret persisted under DATA_DIR — generated once on first boot so a
 *      single-node self-host "just works" and existing sessions survive restarts.
 *
 * Keeping the generated secret on the data volume (not in the image or repo)
 * means it isn't committed and isn't lost on container recreation.
 */
let cached: string | null = null;

export function getJwtSecret(): string {
  if (cached) return cached;
  if (env.JWT_SECRET) {
    cached = env.JWT_SECRET;
    return cached;
  }

  const dir = resolve(env.DATA_DIR);
  const file = resolve(dir, 'jwt-secret');
  if (existsSync(file)) {
    cached = readFileSync(file, 'utf8').trim();
    return cached;
  }

  mkdirSync(dir, { recursive: true });
  const secret = randomBytes(48).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 });
  console.log(`Generated a new JWT secret at ${file}`);
  cached = secret;
  return cached;
}
