import express, { type Express } from 'express';
import { APP_NAME } from '@balance/shared';

/**
 * Builds the Express app. Kept separate from the boot logic in index.ts so tests
 * can import the app without binding a port. Routers get mounted here as later
 * phases add them (auth, accounts, transactions, …).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // Liveness — process is up. No external dependencies checked.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, app: APP_NAME });
  });

  // Readiness — dependencies (DB) are reachable. DB check wired in Phase 1.
  app.get('/readyz', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
