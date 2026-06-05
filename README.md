# Balance

A self-hosted personal finance tracker — accounts, transactions, categories,
tags, budgets, savings goals, notes, and pay/receive — with a clean, modern UI.

Monorepo (npm workspaces):

- `apps/web` — React + Vite single-page app
- `apps/server` — Express + Drizzle (PostgreSQL) API; also serves the web app in production
- `packages/shared` — types, zod schemas, and helpers shared by both

## Deploy (self-host) — the short version

Requires Docker. From a clone of this repo:

```bash
cp .env.example .env        # optional — defaults work out of the box
docker compose up -d
```

Then open **http://localhost:4000** and complete the one-time **setup wizard** to
create your admin account. That's it — Postgres, migrations, and the app all come
up together.

- **Data** lives in two Docker volumes: `pgdata` (database) and `appdata`
  (uploads + an auto-generated JWT secret). Back these up to back up everything.
- **Skip the wizard:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to seed
  the first admin automatically on first boot.
- **New users:** invite-only by default; the admin can enable open signups from
  the portal. Change the host port with `APP_PORT` in `.env`.

## Develop

Requires Node 20+ and a PostgreSQL to point at (local, Docker, or Neon).

```bash
npm install
# set DATABASE_URL in .env (see .env.example)
npm run db:migrate          # apply the schema
npm run dev                 # server :4000 + web (Vite) + shared watcher
```

Open the Vite URL it prints. The web dev server proxies `/api` to the server on
`:4000`.

### Useful scripts (run from the repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Run server + web + shared together |
| `npm run build` | Build shared, server, and web for production |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Configuration

All configuration is via environment variables — see [`.env.example`](.env.example)
for the full annotated list. The essentials: `DATABASE_URL`, optional
`JWT_SECRET` (auto-generated to `DATA_DIR` if unset), `DATA_DIR`, and the optional
`ADMIN_EMAIL` / `ADMIN_PASSWORD` bootstrap pair.
