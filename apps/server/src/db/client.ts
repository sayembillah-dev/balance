import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

/**
 * Shared Postgres pool + Drizzle client. `node-postgres` works for both a local
 * Postgres and a Neon connection string over TCP. The full schema is passed so
 * the query builder and relational helpers are typed end-to-end.
 */
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export type DB = typeof db;
