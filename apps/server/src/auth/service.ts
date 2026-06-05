import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { UserRole } from '@balance/shared';
import { db } from '../db/client.js';
import { randomBytes } from 'node:crypto';
import {
  users,
  settings,
  savings,
  dashboardLayouts,
  invitations,
  passwordResetTokens,
  refreshTokens,
} from '../db/schema/index.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { seedDefaultsForUser } from '../db/seedDefaults.js';
import { conflict, unauthorized } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tokenVersion: number;
}

const PUBLIC_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  tokenVersion: users.tokenVersion,
} as const;

// Default dashboard widget order for a brand-new account (mirrors the mockup).
const DEFAULT_WIDGETS = [
  'balance',
  'expenses',
  'investment',
  'category',
  'trend',
  'transactions',
  'bills',
  'goal',
];

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function userCount(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}

/**
 * Creates a user with everything a fresh account needs, atomically: the user
 * row, the per-user singletons (settings, savings pool, dashboard layout), and a
 * starter taxonomy of default categories + tags. Rolls back entirely on failure.
 */
export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}): Promise<AuthUser> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
    columns: { id: true },
  });
  if (existing) throw conflict('That email is already registered');

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role ?? 'user',
      })
      .returning(PUBLIC_COLUMNS);

    const userId = row!.id;
    await tx.insert(settings).values({ userId });
    await tx.insert(savings).values({ userId });
    await tx.insert(dashboardLayouts).values({ userId, widgetIds: DEFAULT_WIDGETS });
    await seedDefaultsForUser(tx, userId);

    return row!;
  });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthUser> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Same error whether the email is unknown or the password is wrong.
  if (!user || user.isActive === 0) throw unauthorized('Invalid email or password');
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw unauthorized('Invalid email or password');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Validates an invite token against an email. Returns the invite row (with its
 * granted role) if usable, else null. Does not mark it consumed — the caller
 * does that only after the user is successfully created.
 */
export async function findUsableInvite(token: string, email: string) {
  const row = await db.query.invitations.findFirst({
    where: eq(invitations.tokenHash, sha256(token)),
  });
  if (!row) return null;
  if (row.acceptedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.email && row.email.toLowerCase() !== email.toLowerCase()) return null;
  return row;
}

export async function markInviteAccepted(
  inviteId: string,
  userId: string,
): Promise<void> {
  await db
    .update(invitations)
    .set({ acceptedAt: new Date(), acceptedById: userId })
    .where(eq(invitations.id, inviteId));
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Creates a password-reset token for an email if it maps to a user. Returns the
 * plaintext token (caller delivers it via email or surfaces the link), or null
 * when the email is unknown — callers should still respond identically so the
 * endpoint doesn't leak which emails are registered.
 */
export async function createPasswordReset(email: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (!user) return null;
  const token = randomBytes(32).toString('hex');
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });
  return token;
}

/**
 * Consumes a reset token and sets a new password. Bumps token_version (logs the
 * user out of every access token) and revokes all their refresh tokens.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  const row = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, sha256(token)),
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, row.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, row.userId));
  });
}

/**
 * Idempotent first-admin seed from env. Runs at startup: if the instance has no
 * users yet and ADMIN_EMAIL/ADMIN_PASSWORD are both set, creates that admin and
 * skips the setup wizard. Safe to run on every boot.
 */
export async function bootstrapAdminFromEnv(
  email: string | undefined,
  password: string | undefined,
): Promise<void> {
  if (!email || !password) return;
  if ((await userCount()) > 0) return;
  await createUser({ email, password, name: 'Admin', role: 'admin' });
  console.log(`Seeded admin account ${email} from environment`);
}
