import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { verifyAccessToken } from './tokens.js';
import { unauthorized, forbidden } from '../lib/errors.js';

/**
 * Authenticates a request from its Bearer access token. We deliberately load the
 * user row (one indexed PK lookup) rather than trusting the JWT blindly, so that
 * deactivation, role changes, and "log out everywhere" (token_version bump) take
 * effect immediately instead of waiting out the access-token TTL.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();

    const payload = verifyAccessToken(header.slice('Bearer '.length));
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, role: true, tokenVersion: true, isActive: true },
    });

    if (!user || user.isActive === 0) throw unauthorized('Account is inactive');
    if (user.tokenVersion !== payload.tv) {
      throw unauthorized('Session no longer valid');
    }

    req.auth = { userId: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/** Must follow requireAuth. Rejects non-admin users. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== 'admin') return next(forbidden('Admin only'));
  next();
}

/** Reads the authenticated user id, asserting requireAuth has run. */
export function authedUserId(req: Request): string {
  if (!req.auth) throw unauthorized();
  return req.auth.userId;
}
