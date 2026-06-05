import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside the server process (and bundles this config as CJS,
// so import.meta isn't available). cwd is apps/server, so the root .env is two up.
config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig({
  // Point at compiled output: drizzle-kit's loader resolves the NodeNext `.js`
  // import extensions against real files in dist (run `tsc -b` first; the
  // db:generate script does this for you).
  schema: './dist/db/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://balance:balance@localhost:5432/balance',
  },
});
