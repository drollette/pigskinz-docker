# --- deps & build -----------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# better-sqlite3 compiles a native binding via node-gyp; these are needed
# whenever npm can't fetch a prebuilt binary for the target platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx next build

# --- runtime ------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# sqlite3 CLI: used by the backup sidecar's `.backup` command (see
# backup/backup.sh) and handy for manual inspection of the volume.
# python3/make/g++: same as above, needed again for the production-only
# `npm ci` below to (re)build better-sqlite3's native binding.
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

VOLUME ["/data"]
EXPOSE 3000

# Migrations are idempotent (scripts/migrate.mjs tracks what's applied in a
# _migrations table) so running them on every container start is safe, and
# means a fresh volume gets its schema created automatically.
CMD ["sh", "-c", "node scripts/migrate.mjs && npx tsx server.ts"]
