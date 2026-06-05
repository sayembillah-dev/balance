import { env } from './config/env.js';
import { createApp } from './app.js';
import { bootstrapAdminFromEnv } from './auth/service.js';

async function main() {
  // Seed the first admin from env if configured and the instance is empty.
  await bootstrapAdminFromEnv(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Balance server listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(`\n${signal} received, shutting down…`);
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
