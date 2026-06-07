# Balance — single image that builds the shared lib, the API server, and the web
# SPA, then runs the server (which also serves the SPA). Debian base (node slim)
# so argon2's native addon builds and runs without musl/Alpine friction.

# ---- builder ----
FROM node:22-slim AS builder
WORKDIR /app

# Toolchain for argon2's native build.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (cached unless a package manifest changes).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build everything (shared → server → web).
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
# Runtime defaults for the self-host image. Override via .env / compose if needed.
ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data \
    STORAGE_DRIVER=local

# Bring over the fully built workspace (node_modules incl. the compiled argon2
# addon, all dist output, and the drizzle migrations).
COPY --from=builder /app /app

EXPOSE 4000

# Container health: poll the readiness probe (DB reachable). Uses Node's global
# fetch so we don't need curl in the slim image. start-period covers boot + the
# migration step in CMD below.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations, then start the server. Fails fast if migration fails.
CMD ["sh", "-c", "node apps/server/dist/db/migrate.js && node apps/server/dist/index.js"]
