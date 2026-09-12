# Pigskinz (self-hosted)

An NFL pick 'em pool: pick the straight-up winner of every game each week, predict the tiebreaker game's
combined score, and climb a season-long leaderboard. This is a Docker-native port of a Next.js app
originally built for Cloudflare Workers/D1 — see `CLAUDE.md` for what changed and why.

Runs as a single container: Next.js, an in-process WebSocket relay (live scores/picks/chat), and a
15-minute cron loop, all in one process, backed by one SQLite file on a volume.

## Quickstart (Docker Compose)

```bash
cp .env.example .env   # fill in real values
docker compose up -d --build
```

This starts three services:

- **app** — the Next.js server (internal port 3000)
- **caddy** — reverse proxy + automatic TLS (needs `SITE_DOMAIN` set to a real, publicly resolvable
  domain to actually get a certificate; defaults to `localhost` for local testing)
- **backup** — a sidecar that snapshots the database on a schedule (see [Backups](#backups))

The database schema is created automatically on first start (`scripts/migrate.mjs` runs before the
server starts, every time — it's idempotent).

For local development without Caddy/TLS, run the app directly:

```bash
npm install
npm run dev          # http://localhost:3000, DATABASE_PATH defaults to ./data/pigskinz.db
```

## Running on a home server

This app was built with exactly this in mind — one machine that's on all the time (a spare PC, a
Raspberry Pi 4/5, a NAS that can run Docker, etc.), no cloud account required.

**1. Prerequisites on the server**

- [Docker Engine and the Compose plugin](https://docs.docker.com/engine/install/) installed
- `git` installed, or just copy the repo over some other way
- Docker set to start on boot, so a power cut doesn't leave the pool down until someone notices:
  `sudo systemctl enable docker` (the containers themselves already have `restart: unless-stopped`,
  so once Docker is running they come back up on their own)

**2. Get a domain name pointed at your home connection**

Most home internet connections don't have a static public IP, so `SITE_DOMAIN` needs a **dynamic DNS**
hostname rather than a domain you'd point with a normal A record: a free option like
[DuckDNS](https://www.duckdns.org/) or [No-IP](https://www.noip.com/), or your router's built-in
dynamic DNS client if it has one (most consumer routers do, under a name like "DDNS"). Either way, you
end up with a hostname (e.g. `mypool.duckdns.org`) that keeps resolving to your home IP even when it
changes.

**3. Forward ports 80 and 443**

In your router's settings, forward external ports 80 and 443 to the local IP address of the machine
running Docker (both to the same ports). Caddy needs port 80 reachable from the internet to complete
Let's Encrypt's certificate challenge, and 443 for the actual HTTPS traffic — without this, `SITE_DOMAIN`
will never get a real certificate no matter how it's set.

**4. Clone, configure, and start**

```bash
git clone https://github.com/<your-fork>/pigskinz-docker
cd pigskinz-docker
cp .env.example .env
```

Edit `.env`: at minimum set `SITE_URL`/`SITE_DOMAIN` to your dynamic DNS hostname (e.g.
`https://mypool.duckdns.org` / `mypool.duckdns.org`), `INVITATION_CODE` to something only you share with
people you want in the pool, and `SENDGRID_API_KEY` if you want email (verification, password reset,
reminders) to work.

```bash
docker compose up -d --build
docker compose logs -f      # watch startup; Ctrl-C to stop watching (containers keep running)
```

The first real request to your domain will take a few extra seconds while Caddy fetches its
certificate. After that, `https://mypool.duckdns.org` should load the app from anywhere.

**5. Keep it updated**

```bash
git pull
docker compose up -d --build
```

This rebuilds only what changed and restarts the affected containers; the database volume (and
anything in `secrets/`) is untouched.

**6. Set up backups before you need them** — see [Backups](#backups) below. A home server has no cloud
provider quietly backing up a managed database for you the way Cloudflare D1 did; this step is on you.

## Environment variables

See `.env.example` for the full list with explanations. Nothing in this repo ships with real secrets,
a real domain, or any one operator's personal or financial details — every value is a placeholder you
replace.

At minimum for a working deployment: `SITE_URL`/`SITE_DOMAIN`, `SENDGRID_API_KEY` (or email sending
just fails — picks/login still work), and `INVITATION_CODE`.

## Database

SQLite via `better-sqlite3` + Drizzle ORM, schema in `src/db/schema.ts`. Migrations are hand-written
SQL files in `drizzle/`, applied in order by `scripts/migrate.mjs` (tracked in a `_migrations` table so
re-running is safe). See CLAUDE.md for why these are hand-written rather than `drizzle-kit generate`d.

```bash
npm run db:migrate   # apply any pending migrations
npm run db:studio    # browse the local database
npm run db:seed      # load fake example.com users with picks, for local testing
```

## Backups

The `backup` service snapshots the database on a schedule (`BACKUP_INTERVAL_SECONDS`, default daily)
using `sqlite3 <path> ".backup '<dest>'"` — never a raw file copy, which can capture a torn snapshot of
a live WAL-mode database. Uploading offsite is optional and uses [rclone](https://rclone.org/), which
speaks Google Drive, Dropbox, S3, etc. through the same config:

```bash
# One-time setup, from anywhere with rclone installed:
rclone config create gdrive drive          # or: rclone config create dropbox dropbox
rclone config create backup-crypt crypt \
  remote=gdrive:pigskinz-backups \
  password="$(rclone obscure <a-passphrase-you-choose>)"

# Copy the resulting config into this repo (gitignored):
cp ~/.config/rclone/rclone.conf ./secrets/rclone.conf
```

Without `secrets/rclone.conf`, the backup service still takes local snapshots (in the container's
`/tmp`, discarded on restart) but logs that there's nowhere to upload them — set this up before you
need it. To restore: stop the `app` service, `rclone copy` the snapshot down, `gunzip` it, replace the
file in the `pigskinz-data` volume, and start `app` back up.

## Architecture notes

| Concern | Implementation |
|---|---|
| Web server | `server.ts` — a custom server (needed to intercept WebSocket upgrades before Next's own handler) |
| Realtime (scores/picks/chat) | In-process WebSocket relay, `src/realtime/locker-room.ts` |
| Scheduled jobs | `node-cron` in the same process, `src/cron/index.ts` (every 15 min) |
| Database | SQLite (`better-sqlite3` + Drizzle), one file on a Docker volume |
| Reverse proxy / TLS | Caddy, automatic Let's Encrypt certificates |

See `CLAUDE.md` for the non-obvious constraints (why a custom server, why the cron loop is one process
instead of a real scheduler, how ESPN syncing works, etc.) — worth reading before making changes.

## Commands

```bash
npm run dev          # local dev server (custom server + cron + WS, via tsx)
npm run build        # next build
npx tsc --noEmit      # typecheck
npm start            # production server (what the Docker image runs)
```

No automated test suite yet. Verification is `tsc --noEmit` + `next build` + manual smoke-testing.
