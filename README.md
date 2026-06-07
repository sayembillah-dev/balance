<div align="center">

# 💰 Balance

### Your money, your server, your rules.

A **self-hosted personal finance tracker** with a clean, modern UI — accounts,
transactions, budgets, savings goals, and more. No subscriptions, no data mining,
no cloud you don't control. Spin it up with one command and own your finances.

<br/>

![Self-hosted](https://img.shields.io/badge/self--hosted-100%25-22c55e?style=for-the-badge)
[![Docker Image](https://img.shields.io/badge/ghcr.io-sayembillah--dev%2Fbalance-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/sayembillah-dev/balance/pkgs/container/balance)
![Node](https://img.shields.io/badge/Node-22-339933?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)

[**Quick Deploy**](#-quick-deploy-no-source-needed) ·
[**Full Setup Guide**](#-deploy-with-docker-compose-step-by-step) ·
[**Run Locally**](#-run-locally-development) ·
[**Configuration**](#-configuration) ·
[**FAQ**](#-faq--troubleshooting)

</div>

---

## ✨ Features

Everything you need to track your money — and nothing you don't.

| | |
|---|---|
| 🏦 **Accounts** | Track balances across as many accounts as you like |
| 💸 **Transactions** | Fast entry with categories, tags, and notes |
| 🗂️ **Categories & Tags** | Organize spending your way |
| 📊 **Budgets** | Set limits and watch them live |
| 🎯 **Savings Goals** | Define targets and track progress |
| 🤝 **Pay / Receive** | Keep tabs on money you owe and money owed to you |
| 📝 **Notes** | Jot down anything, attached to your finances |
| 🧾 **Receipt Uploads** | Attach images to transactions; set a profile picture |
| 🌍 **Multi-Currency** | Pick an app-wide currency, applied instantly |
| 📐 **Custom Dashboard** | Rearrangeable widgets wired to your real data |
| 🤖 **Built-in Assistant** | A data-grounded chat helper — works offline, no API key |
| 🧙 **First-Run Wizard** | Guided onboarding the first time you open the app |
| 🛡️ **Admin Portal** | Manage users, invitations, and instance settings |
| 🔐 **Secure by Default** | argon2id password hashing, rotating JWT sessions, invite-only signups |

---

## ⚡ Quick Deploy (no source needed)

**No `git clone` required.** Copy the snippet below into a file called
`docker-compose.yml`, then run two commands — that's it.

```yaml
# docker-compose.yml — save this file, nothing else needed
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-balance}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-balance}
      POSTGRES_DB: ${POSTGRES_DB:-balance}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-balance}"]
      interval: 5s
      retries: 12

  app:
    image: ghcr.io/sayembillah-dev/balance:latest
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-balance}:${POSTGRES_PASSWORD:-balance}@db:5432/${POSTGRES_DB:-balance}
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
    env_file:
      - path: .env
        required: false
    ports:
      - "${APP_PORT:-4000}:4000"
    volumes:
      - appdata:/data

volumes:
  pgdata:
  appdata:
```

```bash
docker compose pull          # pull the latest image from ghcr.io
docker compose up -d         # start in the background
```

Open **http://localhost:4000** — the first boot shows the setup wizard.

> **Want to change the port or DB password?** Create an `.env` file next to
> `docker-compose.yml` (see [Configuration](#-configuration)).

---

## 🐳 Deploy with Docker Compose (Step by Step)

New to Docker? No problem. Follow these steps exactly and you'll have Balance
running. **You don't need to know any Docker internals** — Compose does the work.

### Step 0 — Install Docker

Install **[Docker Desktop](https://docs.docker.com/get-docker/)** (Mac/Windows)
or **Docker Engine + Compose plugin** (Linux). When it's working, this prints a
version number:

```bash
docker --version
docker compose version
```

> ℹ️ Modern Docker uses `docker compose` (a space). If you have an older setup
> that only has `docker-compose` (a hyphen), use that form instead everywhere below.

### Step 1 — Get the compose file

**Option A — published image (recommended, no source needed)**

Create an empty folder, save the compose snippet from the
[Quick Deploy](#-quick-deploy-no-source-needed) section above as
`docker-compose.yml` inside it, then move into that folder. You are now ready
for Step 2. You do *not* need the `Dockerfile`, source code, or `.env.example`.

**Option B — build from source**

Clone the repo if you want to build the image yourself or hack on the code:

```bash
git clone https://github.com/sayembillah-dev/balance.git balance
cd balance
```

Every command below is run from this folder. Check you're in the right place:

```bash
ls
# you should see: docker-compose.yml  Dockerfile  .env.example  apps  packages ...
```

### Step 2 — Create your `.env` file

The repo ships a template called **`.env.example`**. You make your own copy named
exactly **`.env`** (this is the file Docker reads). It lives **in the same folder
as `docker-compose.yml`**:

```bash
cp .env.example .env
```

> 📌 The file **must be named `.env`** (with the leading dot, no extension) and
> sit **next to `docker-compose.yml`**. That's the only place Compose looks for it.

Now open `.env` in any text editor. **You can leave everything as-is to start** —
the defaults work. But for a real deployment, you'll want to change at least these:

```bash
# Make the database password your own (not the demo default)
POSTGRES_PASSWORD=choose-a-strong-password

# (Optional) Create your admin login automatically and skip the setup wizard
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=another-strong-password

# (Optional) Run on a different port — e.g. http://localhost:8080
APP_PORT=4000
```

> 🔐 **`.env` holds your secrets** (DB password, admin password). It is already
> listed in `.gitignore`, so it won't be committed — keep it that way.

### Step 3 — Understand what you're about to run *(optional but helpful)*

The [`docker-compose.yml`](docker-compose.yml) file describes **two containers**
("services") that run together. Here's the whole file, explained:

```yaml
services:
  db:                                   # ① The PostgreSQL database
    image: postgres:16                  #    Pulled ready-made from Docker Hub
    restart: unless-stopped             #    Auto-restarts if it crashes / on reboot
    environment:                        #    Its credentials — filled from your .env
      POSTGRES_USER: ${POSTGRES_USER:-balance}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-balance}
      POSTGRES_DB: ${POSTGRES_DB:-balance}
    volumes:
      - pgdata:/var/lib/postgresql/data #    Database files are saved in the "pgdata" volume
    healthcheck: ...                    #    Lets the app wait until the DB is ready

  app:                                  # ② The Balance app (API + website)
    build: .                            #    Built from the Dockerfile in this folder
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }#    Don't start until the database is healthy
    environment:
      DATABASE_URL: postgres://...@db:5432/...  # How the app reaches the DB container
    env_file:
      - path: .env                      #    Reads your .env (optional — works without it)
        required: false
    ports:
      - "${APP_PORT:-4000}:4000"        #    Exposes the app at http://localhost:4000
    volumes:
      - appdata:/data                   #    Uploads + secret are saved in the "appdata" volume

volumes:                                # ③ The named volumes that persist your data
  pgdata:
  appdata:
```

**The three things to understand:**

- **`${POSTGRES_PASSWORD:-balance}`** means *"use `POSTGRES_PASSWORD` from `.env`,
  or fall back to `balance` if it's not set."* This is how your `.env` plugs in.
- **`ports: "4000:4000"`** maps a port on *your computer* (left) to a port *inside
  the container* (right). Visit the left number in your browser.
- **`volumes`** are how your data survives restarts — see the next step. 👇

### Step 4 — How your data is stored (volumes)

You **don't create any folders or volumes yourself** — Docker creates and manages
them automatically the first time you start. Balance uses two **named volumes**:

| Volume | What's inside | Why it matters |
|---|---|---|
| `pgdata` | The entire PostgreSQL database | All your accounts, transactions, everything |
| `appdata` | Uploaded images + the auto-generated login secret | Receipts, profile pictures, session key |

Because these are **named volumes**, your data is kept safely *outside* the
containers. You can stop, rebuild, or update the app and your data stays put.
**To back up Balance, you back up these two volumes** (see
[Data & Backups](#-data--backups)).

> 🆚 Prefer to see your DB files as a folder on disk instead? You can swap the
> named volume for a *bind mount* like `./pgdata:/var/lib/postgresql/data`. Named
> volumes are recommended (faster and safer) unless you have a specific reason.

### Step 5 — Start it 🚀

**Option A — published image**

```bash
docker compose pull          # fetch the latest Balance image from ghcr.io
docker compose up -d         # start everything in the background
```

**Option B — build from source**

```bash
docker compose up -d --build
```

The first `--build` run takes a few minutes (compiles the full app). After that,
omit `--build` for fast restarts.

On the very first boot Balance automatically:

1. 📥 Pulls / uses the PostgreSQL image and starts the database
2. 🗃️ Applies all database migrations (creates the tables)
3. 🌐 Starts serving the app

> The `-d` means "detached" — it runs in the background. Drop it if you'd rather
> watch the logs live in your terminal.

### Step 6 — Open Balance 🎉

Go to **[http://localhost:4000](http://localhost:4000)** (or your `APP_PORT`).

- If you **didn't** set `ADMIN_EMAIL`/`ADMIN_PASSWORD`: you'll see a one-time
  **setup wizard** — create your admin account there.
- If you **did** set them: just log in with those credentials.

That's it — you're self-hosting Balance. 💚

### Step 7 — Everyday commands

Run these from the `balance/` folder whenever you need them:

```bash
docker compose ps              # Are my services up and healthy?
docker compose logs -f         # Watch the logs live (Ctrl+C to stop watching)
docker compose logs -f app     # Just the app's logs
docker compose restart app     # Restart only the app
docker compose stop            # Pause everything (data kept)
docker compose down            # Stop & remove containers (data kept in volumes)

# Update to the latest published image
docker compose pull && docker compose up -d

# Rebuild & restart from source (Option B users)
docker compose up -d --build
```

> ⚠️ **Careful:** `docker compose down -v` adds `-v`, which **deletes the volumes
> too** — that wipes your database and uploads. Only use `-v` if you truly want to
> start over from scratch.

---

## 🧑‍💻 Run Locally (Development)

For hacking on Balance with hot-reload across the whole stack.

> **Prerequisites:** **Node 20+** and a **PostgreSQL** database to point at
> (a local Postgres, a Docker one, or a free [Neon](https://neon.tech) instance).

**1. Install dependencies**
```bash
npm install
```

**2. Configure your database**
```bash
cp .env.example .env
# then edit .env and set DATABASE_URL, e.g.
#   DATABASE_URL=postgres://balance:balance@localhost:5432/balance
```

**3. Apply the database schema**
```bash
npm run db:migrate
```

**4. Start everything (server + web + shared, all watching)**
```bash
npm run dev
```

Open the **Vite URL** it prints (usually `http://localhost:5173`). The web dev
server proxies `/api` to the backend on `:4000`, so auth and data Just Work. ✨

---

## 🧰 Useful Scripts

Run these from the repo root.

| Command | What it does |
|---|---|
| `npm run dev` | Run server + web + shared together, with hot-reload |
| `npm run build` | Production build of shared, server, and web |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:generate` | Generate a new migration after you change the schema |
| `npm run db:studio` | Open Drizzle Studio — a visual DB browser |
| `npm test` | Run the server test suite |

> 💡 **You almost never run the `db:*` scripts by hand.** Migrations apply
> **automatically** inside the container on every deploy. `db:generate` is only
> for when *you* change the schema; `db:studio` is an optional dev convenience.

---

## ⚙️ Configuration

All configuration is via environment variables — see
[`.env.example`](.env.example) for the full annotated list. Here are the ones
that matter:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ (dev) | — | Postgres connection string. Set by Compose automatically in Docker. |
| `DATA_DIR` | — | `/data` (Docker) | Where uploads + the generated JWT secret live |
| `JWT_SECRET` | — | auto-generated | Session signing key. Auto-created in `DATA_DIR` if unset; set explicitly to share across replicas |
| `STORAGE_DRIVER` | — | `local` | Upload storage: `local` today (`s3` planned) |
| `APP_PORT` | — | `4000` | Host port to expose the app on (Docker) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | — | Seed the first admin and skip the setup wizard |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | — | Email for password-reset + invites. Without it, those links surface in the admin portal / logs |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | `balance` | Credentials for the bundled Postgres (Docker) |

<details>
<summary><b>Notes for the Docker stack</b></summary>

<br/>

- **Runtime defaults** (`PORT`, `DATA_DIR=/data`, `STORAGE_DRIVER=local`,
  `NODE_ENV=production`) are baked into the image, so `docker-compose.yml` only
  wires the deploy-specific bits. Override any of them via `.env`.
- **`.env` is optional** — `docker compose up` works with the built-in defaults.
- **`DATABASE_URL`** is set in Compose (not `.env`) so the in-container `db` host
  always wins, even if a dev `.env` points it at localhost.

</details>

---

## 💾 Data & Backups

Your data lives in **two Docker volumes** — back these up and you've backed up
everything:

| Volume | Contents |
|---|---|
| `pgdata` | The PostgreSQL database (accounts, transactions, everything) |
| `appdata` | Uploaded images + the auto-generated JWT secret |

```bash
# Quick database dump
docker compose exec db pg_dump -U balance balance > balance-backup.sql
```

---

## 🏗️ Architecture

A TypeScript monorepo using **npm workspaces**:

```
balance/
├── apps/
│   ├── web/         React + Vite single-page app (the UI)
│   └── server/      Express + Drizzle API — also serves the web app in production
├── packages/
│   └── shared/      Types, Zod schemas, and helpers shared by both
├── Dockerfile       Single image: builds shared → server → web, then runs the server
└── docker-compose.yml   Postgres + app, with health checks and auto-migrations
```

**Tech stack**

- **Frontend** — React 19, Vite, Tailwind CSS 4, Radix UI, lucide-react, React Router 7
- **Backend** — Express 5, Drizzle ORM, PostgreSQL 16, argon2id, JWT, Zod
- **Shared** — End-to-end type safety via shared TypeScript types + Zod schemas

> In production a **single container** serves both the API and the built SPA on
> one port — no separate web server to manage.
>
> **Health checks** (no auth required):
>
> | Endpoint | Purpose | Status codes |
> | --- | --- | --- |
> | `GET /healthz`, `/health/live` | Liveness — process is up (no dependencies) | `200` |
> | `GET /readyz`, `/health/ready` | Readiness — database reachable (gates traffic) | `200` / `503` |
> | `GET /health` | Full report — DB, storage & memory with per-check latency, plus version/uptime/runtime | `200` (healthy/degraded) / `503` (critical failure) |
>
> The full report's overall `status` is `pass`, `warn` (degraded but usable —
> e.g. slow DB or non-writable storage), or `fail` (a critical check is down).

---

## ❓ FAQ & Troubleshooting

<details>
<summary><b>The app won't start / can't connect to the database</b></summary>

<br/>

In Docker, the app waits for Postgres to be healthy before starting. Check logs:
```bash
docker compose logs -f
```
For local dev, make sure `DATABASE_URL` in `.env` points at a running Postgres and
that you've run `npm run db:migrate`.
</details>

<details>
<summary><b>How do I add more users?</b></summary>

<br/>

Signups are **invite-only by default**. As the admin, open the portal to send
invitations — or flip the setting to allow open signups.
</details>

<details>
<summary><b>I didn't set up SMTP — how do reset/invite links work?</b></summary>

<br/>

They're surfaced in the **admin portal** and the **server logs** instead of being
emailed. Set the `SMTP_*` variables to send real emails.
</details>

<details>
<summary><b>Does the AI assistant send my data anywhere?</b></summary>

<br/>

No. The built-in assistant runs **entirely in your browser**, grounded in your own
data, and needs no API key. It's a local helper out of the box — you can optionally
wire it to a real model, but nothing leaves your machine by default.
</details>

<details>
<summary><b>How do I change the port?</b></summary>

<br/>

Set `APP_PORT` in `.env` (Docker), e.g. `APP_PORT=8080`, then
`docker compose up -d`.
</details>

---

<div align="center">

**Balance** — own your finances. 💚

<sub>Self-hosted with care. Your data never leaves your server.</sub>

</div>
