import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

/**
 * Applies pending migrations, then exits. Run standalone (`npm run db:migrate`)
 * and again as the container entrypoint before the server starts listening, so a
 * fresh deploy comes up with an up-to-date schema. Fails fast (non-zero exit) so
 * a bad migration surfaces instead of booting against a stale schema.
 */
async function main() {
  const migrationsFolder = resolve(import.meta.dirname, '../../drizzle');
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
