import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { apiRouter } from './resources/index.js';
import { healthRouter } from './lib/health.js';
import { notFoundHandler, errorHandler } from './lib/errors.js';

// In production the built web SPA is bundled alongside the server (one container
// serves API + app). In dev this folder doesn't exist and Vite serves the web.
const WEB_DIST = resolve(import.meta.dirname, '../../web/dist');

/**
 * Builds the Express app. Kept separate from the boot logic in index.ts so tests
 * can import the app without binding a port. Routers get mounted here as later
 * phases add them (accounts, transactions, …).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Health checks: /healthz (liveness), /readyz (readiness), /health (full report).
  app.use(healthRouter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', apiRouter);
  // Unmatched API routes get a JSON 404 (not the SPA fallback below).
  app.use('/api', notFoundHandler);

  if (existsSync(WEB_DIST)) {
    // Serve built assets, and fall back to index.html for client-side routes.
    app.use(express.static(WEB_DIST));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(resolve(WEB_DIST, 'index.html'));
    });
  } else {
    app.use(notFoundHandler);
  }

  app.use(errorHandler);
  return app;
}
