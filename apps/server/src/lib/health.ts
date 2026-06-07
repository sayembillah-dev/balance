import { Router, type Request, type Response } from 'express';
import { readFileSync, constants as FS } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { APP_NAME } from '@balance/shared';
import { pool } from '../db/client.js';
import { env } from '../config/env.js';

/**
 * Health check API.
 *
 * Three levels, so liveness/readiness probes stay cheap while humans (or an
 * uptime monitor / status page) can still pull a full report:
 *
 *   GET /healthz, /health/live   — liveness. Process is up. No dependencies hit.
 *   GET /readyz,  /health/ready  — readiness. The DB is reachable (gates traffic).
 *   GET /health                  — full report: per-subsystem status + latency,
 *                                  plus version, uptime and memory.
 *
 * Each subsystem check reports one of: `pass` (healthy), `warn` (degraded but
 * usable), `fail` (broken). The overall status is the worst of its checks, but
 * only a *critical* check (the database) can take the whole endpoint to `fail`
 * and a 503 — storage or memory trouble degrades to `warn` with a 200 so a
 * monitor can distinguish "down" from "limping".
 */

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  status: CheckStatus;
  /** Round-trip time of the probe, when one was performed. */
  latencyMs?: number;
  /** Present only when the check did not pass. */
  error?: string;
  [key: string]: unknown;
}

const round = (n: number): number => Math.round(n * 10) / 10;
const toMb = (bytes: number): number => round(bytes / 1024 / 1024);
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// Latencies above these (ms) flag a healthy-but-slow dependency as `warn`.
const SLOW_DB_MS = 500;
const SLOW_STORAGE_MS = 250;

/** Read the package version once at load; cosmetic, so failure is non-fatal. */
const VERSION: string = (() => {
  try {
    const raw = readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

/** Run an async probe and capture its wall-clock time, swallowing the throw. */
async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; error?: unknown }> {
  const start = performance.now();
  try {
    await fn();
    return { ms: round(performance.now() - start) };
  } catch (error) {
    return { ms: round(performance.now() - start), error };
  }
}

/** Critical dependency: a trivial query proves the pool can reach Postgres. */
async function checkDatabase(): Promise<CheckResult> {
  const { ms, error } = await timed(() => pool.query('select 1'));
  if (error) return { status: 'fail', latencyMs: ms, error: messageOf(error) };
  return { status: ms > SLOW_DB_MS ? 'warn' : 'pass', latencyMs: ms };
}

/** Non-critical: round-trip a probe file so we know uploads can be written. */
async function checkStorage(): Promise<CheckResult> {
  const dir = resolve(env.DATA_DIR, 'uploads');
  const probe = resolve(dir, `.healthcheck-${process.pid}`);
  const { ms, error } = await timed(async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(probe, 'ok');
    await access(probe, FS.R_OK | FS.W_OK);
    await unlink(probe);
  });
  if (error) {
    return { status: 'warn', latencyMs: ms, driver: env.STORAGE_DRIVER, writable: false, error: messageOf(error) };
  }
  return { status: ms > SLOW_STORAGE_MS ? 'warn' : 'pass', latencyMs: ms, driver: env.STORAGE_DRIVER, writable: true };
}

/** Informational: surface memory pressure before the process OOMs. */
function checkMemory(): CheckResult {
  const m = process.memoryUsage();
  const heapUsedPct = m.heapTotal ? Math.round((m.heapUsed / m.heapTotal) * 100) : 0;
  return {
    status: heapUsedPct > 95 ? 'warn' : 'pass',
    rssMb: toMb(m.rss),
    heapUsedMb: toMb(m.heapUsed),
    heapTotalMb: toMb(m.heapTotal),
    heapUsedPct,
  };
}

/** Worst-of the checks; only a failing *critical* check yields `fail`. */
function overallStatus(checks: Array<{ critical: boolean; result: CheckResult }>): CheckStatus {
  let worst: CheckStatus = 'pass';
  for (const { critical, result } of checks) {
    if (result.status === 'fail') {
      if (critical) return 'fail';
      worst = 'warn';
    } else if (result.status === 'warn' && worst === 'pass') {
      worst = 'warn';
    }
  }
  return worst;
}

const httpStatusFor = (status: CheckStatus): number => (status === 'fail' ? 503 : 200);

// Liveness — the process answered. Deliberately touches nothing external so an
// orchestrator never restarts a healthy app just because a dependency blipped.
function liveness(_req: Request, res: Response): void {
  res.json({
    status: 'pass',
    app: APP_NAME,
    version: VERSION,
    uptime: round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

// Readiness — safe to route traffic here? Gated on the database alone.
async function readiness(_req: Request, res: Response): Promise<void> {
  const database = await checkDatabase();
  const status: CheckStatus = database.status === 'fail' ? 'fail' : 'pass';
  res.status(httpStatusFor(status)).json({
    status,
    checks: { database },
    timestamp: new Date().toISOString(),
  });
}

// Full report — everything, for a status page or an on-call human.
async function fullHealth(_req: Request, res: Response): Promise<void> {
  const [database, storage] = await Promise.all([checkDatabase(), checkStorage()]);
  const memory = checkMemory();

  const status = overallStatus([
    { critical: true, result: database },
    { critical: false, result: storage },
    { critical: false, result: memory },
  ]);

  res.status(httpStatusFor(status)).json({
    status,
    app: APP_NAME,
    version: VERSION,
    env: env.NODE_ENV,
    node: process.version,
    pid: process.pid,
    uptime: round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: { database, storage, memory },
  });
}

export const healthRouter: Router = Router();

healthRouter.get(['/healthz', '/health/live'], liveness);
healthRouter.get(['/readyz', '/health/ready'], readiness);
healthRouter.get('/health', fullHealth);
