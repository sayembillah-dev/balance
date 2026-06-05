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

# Apply pending migrations, then start the server. Fails fast if migration fails.
CMD ["sh", "-c", "node apps/server/dist/db/migrate.js && node apps/server/dist/index.js"]
