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

This starts two services:

- **app** — the Next.js server, published on the host at `APP_PORT` (default `3000`)
- **backup** — a sidecar that snapshots the database on a schedule (see [Backups](#backups))

There's no reverse proxy or TLS termination in this repo — see [Reverse proxy](#reverse-proxy) below
for putting it behind one.

The database schema is created automatically on first start (`scripts/migrate.mjs` runs before the
server starts, every time — it's idempotent).

For local development, run the app directly instead:

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

Most home internet connections don't have a static public IP, so you'll want a **dynamic DNS**
hostname rather than a domain you'd point with a normal A record: a free option like
[DuckDNS](https://www.duckdns.org/) or [No-IP](https://www.noip.com/), or your router's built-in
dynamic DNS client if it has one (most consumer routers do, under a name like "DDNS"). Either way, you
end up with a hostname (e.g. `mypool.duckdns.org`) that keeps resolving to your home IP even when it
changes. This is what you'll give your reverse proxy in step 3, and what `SITE_URL` should be set to.

**3. Put it behind a reverse proxy**

This repo doesn't run one itself — bring whatever you already have, or set one up if you don't. See
[Reverse proxy](#reverse-proxy) below for the setup either way; you need it done before step 4's
`docker compose up` will be reachable from the internet over HTTPS.

**4. Clone, configure, and start**

```bash
git clone https://github.com/<your-fork>/pigskinz-docker
cd pigskinz-docker
cp .env.example .env
```

Edit `.env`: at minimum set `SITE_URL` to your dynamic DNS hostname (e.g. `https://mypool.duckdns.org`),
`INVITATION_CODE` to something only you share with people you want in the pool, and `SENDGRID_API_KEY`
if you want email (verification, password reset, reminders) to work.

```bash
docker compose up -d --build
docker compose logs -f      # watch startup; Ctrl-C to stop watching (containers keep running)
```

Once your reverse proxy is pointed at this container (step 3), `https://mypool.duckdns.org` should load
the app from anywhere.

**5. Keep it updated**

```bash
git pull
docker compose up -d --build
```

This rebuilds only what changed and restarts the affected containers; the database volume (and
anything in `secrets/`) is untouched.

**6. Set up backups before you need them** — see [Backups](#backups) below. A home server has no cloud
provider quietly backing up a managed database for you the way Cloudflare D1 did; this step is on you.

## Reverse proxy

The `app` container listens on 3000 and is published to the host at `APP_PORT` (default `3000`, set in
`.env`) — that's the only thing any reverse proxy needs to reach: `http://<host-ip>:APP_PORT`. TLS
termination, certificates, and public routing are entirely up to whatever proxy you point at it; this
repo intentionally doesn't bundle one, since most people running a home server already have one for
their other services. Two things matter for whichever proxy you use:

- **WebSocket upgrades must be forwarded** on every path, not just `/api/ws` — live scores/picks/chat
  depend on it. Most reverse proxies forward WebSocket upgrades by default on HTTP/1.1; if picks/chat
  don't update live, check that setting first.
- **Forward the real client IP/host** (`X-Forwarded-For`, `X-Forwarded-Proto`, `Host`) so the app's
  `SITE_URL` and any host-based logic line up with what the browser actually requested.

**Using [nginx-proxy-manager](https://nginxproxymanager.com/):** add a Proxy Host with your domain
(e.g. `mypool.duckdns.org`) as the domain name, `<host-ip>` as "Forward Hostname / IP" (use the Docker
host's LAN IP, or the `app` container's name if nginx-proxy-manager shares this compose network) and
`APP_PORT` (default `3000`) as "Forward Port", enable **Websockets Support** under the Details tab, and
request a Let's Encrypt certificate under the SSL tab with **Force SSL** on.

**Using Traefik, Caddy, or another proxy you already run:** the same three things apply — proxy to
`<host-ip>:APP_PORT`, forward WebSocket upgrades, request/terminate TLS for your domain there.

**No reverse proxy yet:** for a pool you're only using on your home network, you can skip this
entirely and just browse to `http://<host-ip>:APP_PORT` directly — no public domain or TLS needed. You
only need step 3 if you want people outside your network (or on `https://`) to reach the pool.

## Environment variables

See `.env.example` for the full list with explanations. Nothing in this repo ships with real secrets,
a real domain, or any one operator's personal or financial details — every value is a placeholder you
replace.

At minimum for a working deployment: `SITE_URL`, `SENDGRID_API_KEY` (or email sending just fails —
picks/login still work), and `INVITATION_CODE`.

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
| Reverse proxy / TLS | Not bundled — bring your own (nginx-proxy-manager, Traefik, Caddy, etc.), see [Reverse proxy](#reverse-proxy) |

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
