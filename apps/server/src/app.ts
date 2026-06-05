import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { APP_NAME } from '@balance/shared';
import { pool } from './db/client.js';
import { authRouter } from './auth/routes.js';
import { apiRouter } from './resources/index.js';
import { notFoundHandler, errorHandler } from './lib/errors.js';

/**
 * Builds the Express app. Kept separate from the boot logic in index.ts so tests
 * can import the app without binding a port. Routers get mounted here as later
 * phases add them (accounts, transactions, …).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Liveness — process is up. No external dependencies checked.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, app: APP_NAME });
  });

  // Readiness — dependencies (DB) are reachable. Used by the container healthcheck.
  app.get('/readyz', async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'database unreachable' });
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', apiRouter);

  // Must come last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
