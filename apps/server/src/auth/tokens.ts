import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { newId, type UserRole } from '@balance/shared';
import { db } from '../db/client.js';
import { refreshTokens } from '../db/schema/index.js';
import { getJwtSecret } from '../lib/secret.js';
import { unauthorized } from '../lib/errors.js';

export const ACCESS_TTL = '15m';
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessPayload {
  sub: string; // user id
  role: UserRole;
  tv: number; // token_version at mint time
}

export function signAccessToken(p: AccessPayload): string {
  return jwt.sign(p, getJwtSecret(), { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    return { sub: decoded.sub as string, role: decoded.role, tv: decoded.tv };
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

interface TokenContext {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

/**
 * Mints a refresh token. The plaintext is returned to the caller (set as a
 * cookie / stored in secure storage); only its hash is persisted. Belongs to a
 * `familyId` so a whole lineage can be revoked on reuse.
 */
export async function issueRefreshToken(
  userId: string,
  ctx: TokenContext,
  familyId: string = newId(),
): Promise<{ token: string; familyId: string }> {
  const secret = randomBytes(32).toString('hex');
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: sha256(secret),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: ctx.userAgent ?? null,
    ip: ctx.ip ?? null,
  });
  return { token: secret, familyId };
}

async function revokeFamily(familyId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.familyId, familyId));
}

/**
 * Rotates a presented refresh token: revokes it and issues a fresh one in the
 * same family. If the presented token was already revoked (i.e. someone is
 * replaying a token we already rotated past), treats it as theft and revokes the
 * entire family — the OWASP refresh-token reuse-detection pattern.
 */
export async function rotateRefreshToken(
  presented: string,
  ctx: TokenContext,
): Promise<{ token: string; userId: string }> {
  const row = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, sha256(presented)),
  });

  if (!row) throw unauthorized('Invalid refresh token');

  if (row.revokedAt) {
    await revokeFamily(row.familyId);
    throw unauthorized('Refresh token reuse detected');
  }

  if (row.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Refresh token expired');
  }

  const next = await issueRefreshToken(row.userId, ctx, row.familyId);

  // Mark the presented token as rotated, pointing at its successor.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  return { token: next.token, userId: row.userId };
}

/** Logout: revoke just the presented token (best-effort). */
export async function revokeRefreshToken(presented: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, sha256(presented)));
}
