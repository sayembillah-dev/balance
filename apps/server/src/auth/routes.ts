import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import {
  loginSchema,
  signupSchema,
  setupSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from '@balance/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { getAppSetting } from '../lib/appSettings.js';
import {
  userCount,
  createUser,
  authenticate,
  findUsableInvite,
  markInviteAccepted,
  createPasswordReset,
  confirmPasswordReset,
  type AuthUser,
} from './service.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  REFRESH_TTL_MS,
} from './tokens.js';

const REFRESH_COOKIE = 'balance_refresh';
// Scope the cookie to the auth endpoints so it isn't sent on every API call.
const COOKIE_PATH = '/api/v1/auth';

function reqContext(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

function refreshFromReq(req: Request): string | undefined {
  // Web sends it as an httpOnly cookie; native clients send it in the body.
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

const publicUser = (u: AuthUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});

/** Issues an access token, sets the refresh cookie, and returns the auth body. */
async function sendAuth(req: Request, res: Response, user: AuthUser, status = 200) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    tv: user.tokenVersion,
  });
  const { token: refreshToken } = await issueRefreshToken(user.id, reqContext(req));
  setRefreshCookie(res, refreshToken);
  res.status(status).json({ accessToken, refreshToken, user: publicUser(user) });
}

export const authRouter: Router = Router();

// Brute-force protection on credential endpoints. Memory store is fine for a
// single-instance self-host. Not applied to refresh/logout/bootstrap-status.
const rateLimited = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts — please try again later.' } },
});
const resetLimited = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests — please try again later.' } },
});

// Whether the instance still needs its first admin (drives the setup wizard).
authRouter.get('/bootstrap-status', async (_req, res) => {
  res.json({ needsSetup: (await userCount()) === 0 });
});

// One-time first-admin creation. Only reachable while there are zero users.
authRouter.post('/setup', rateLimited, async (req, res) => {
  if ((await userCount()) > 0) {
    throw new AppError('SETUP_ALREADY_DONE', 'Setup has already been completed');
  }
  const input = setupSchema.parse(req.body);
  const user = await createUser({ ...input, role: 'admin' });
  await sendAuth(req, res, user, 201);
});

authRouter.post('/signup', rateLimited, async (req, res) => {
  const input = signupSchema.parse(req.body);

  // Invite path takes precedence; otherwise require open signups to be enabled.
  let role: 'user' | 'admin' = 'user';
  let inviteId: string | null = null;
  if (input.invite) {
    const invite = await findUsableInvite(input.invite, input.email);
    if (!invite) throw unauthorized('Invalid or expired invitation');
    role = invite.role;
    inviteId = invite.id;
  } else if (!(await getAppSetting('allow_open_signups'))) {
    throw new AppError('SIGNUPS_DISABLED', 'Signups are invite-only on this instance');
  }

  const user = await createUser({
    email: input.email,
    password: input.password,
    name: input.name,
    role,
  });
  if (inviteId) await markInviteAccepted(inviteId, user.id);
  await sendAuth(req, res, user, 201);
});

authRouter.post('/login', rateLimited, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await authenticate(input.email, input.password);
  await sendAuth(req, res, user);
});

authRouter.post('/refresh', async (req, res) => {
  const presented = refreshFromReq(req);
  if (!presented) throw unauthorized('Missing refresh token');

  const { token, userId } = await rotateRefreshToken(presented, reqContext(req));
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, role: true, tokenVersion: true, isActive: true },
  });
  if (!user || user.isActive === 0) throw unauthorized('Account is inactive');

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    tv: user.tokenVersion,
  });
  setRefreshCookie(res, token);
  res.json({ accessToken, refreshToken: token });
});

authRouter.post('/logout', async (req, res) => {
  const presented = refreshFromReq(req);
  if (presented) await revokeRefreshToken(presented);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

authRouter.post('/password-reset/request', resetLimited, async (req, res) => {
  const { email } = passwordResetRequestSchema.parse(req.body);
  const token = await createPasswordReset(email);
  // TODO(Phase 9): email the link when SMTP is configured. For now, surface it
  // in the server log so self-hosters without SMTP can still recover access.
  if (token) {
    console.log(`Password reset for ${email}: token=${token}`);
  }
  res.json({ ok: true }); // identical response whether or not the email exists
});

authRouter.post('/password-reset/confirm', rateLimited, async (req, res) => {
  const { token, password } = passwordResetConfirmSchema.parse(req.body);
  await confirmPasswordReset(token, password);
  res.json({ ok: true });
});
