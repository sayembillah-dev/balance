import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { authedUserId } from '../auth/middleware.js';
import { notFound } from '../lib/errors.js';

export const meRouter: Router = Router();

// Current user's profile. Used by the web app to restore session state after a
// page reload (refresh cookie → access token → /me). Editable in a later phase.
meRouter.get('/', async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, authedUserId(req)),
    columns: { id: true, email: true, name: true, phone: true, timezone: true, role: true },
  });
  if (!user) throw notFound('User not found');
  res.json(user);
});
