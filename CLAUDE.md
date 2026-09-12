# CLAUDE.md

Guidance for Claude Code (or any agent) working in this repo. See `README.md` for setup — this file is
about non-obvious constraints and conventions.

## Where this came from

This app was ported from a Cloudflare Workers/D1 deployment to a single self-hosted Docker container.
The port kept the entire Next.js app, database schema, and business logic (`src/lib/*`) unchanged —
only the runtime-specific seams changed:

| Concern | Cloudflare original | Here |
|---|---|---|
| App runtime | Worker via `@opennextjs/cloudflare` | `server.ts`, a custom Node server, run via `tsx` |
| Database | D1 (managed SQLite) | `better-sqlite3` against a file on a Docker volume, WAL mode |
| Realtime (chat/scores) | `GameRoom` Durable Object | In-process WebSocket relay, `src/realtime/locker-room.ts` |
| Scheduled jobs | Workers cron trigger | `node-cron`, same process, `src/cron/index.ts` |
| Secrets | `wrangler secret put` | `.env` / Docker environment variables |
| TLS & routing | Cloudflare edge | Operator's own reverse proxy (not bundled) |

`src/lib/env.ts` is the one seam every environment-dependent read goes through (`getEnv()`/`getDb()`) —
if you're porting this to yet another runtime, that's the file to change.

## Why a custom server run via `tsx`, not `next start`

Something has to own the raw HTTP server so it can intercept WebSocket upgrade requests on `/api/ws`
before handing everything else to Next's own request handler — a Next.js Route Handler can't proxy a
raw 101-status `Response` through its own response pipeline (Node's `Response` type doesn't permit
status 101 at all). See `src/app/api/ws/route.ts`'s comment for the full story; this is the same
constraint the Cloudflare original had with its Durable Object.

`server.ts`, `src/cron/index.ts`, and `src/realtime/locker-room.ts` sit outside Next's own build (which
only compiles the app router tree), so something has to handle their TypeScript at runtime — that's
`tsx`, both in dev (`npm run dev` → `tsx watch server.ts`) and production (the Docker image's `CMD`).
This is also why `next.config.ts` does **not** set `output: "standalone"`: that mode traces dependencies
from the app router tree only, and would miss `ws`/`better-sqlite3`/`node-cron` since none of those are
imported by any Next page or route. The Dockerfile installs a full production `node_modules` instead.

**Path aliases**: files reachable from `server.ts` (`src/cron/`, `src/realtime/`, and anything they
import — currently `src/lib/env.ts`, `src/lib/auto-picks.ts`, `src/lib/pick-reminders.ts`,
`src/lib/email.ts`, `src/lib/site-config.ts`, `src/lib/sync-runner.ts`, `src/lib/espn-client.ts`,
`src/lib/game-sync-core.ts`, `src/db/*`) must use relative imports (`../db`, `./env`), not the `@/...`
alias. `tsx` runs these outside Next's bundler, which is the only thing that resolves `@/...` (via
`tsconfig.json`'s `paths` + Next's own webpack config). Everything else in `src/` — pages, Server
Actions, API routes — is compiled by Next itself and can use `@/...` freely. `game-sync-core.ts` is
imported from both sides (Next-bundled admin routes and the tsx-run cron/sync-runner), which is why it
uses relative imports too, even though it doesn't strictly need to for the Next-bundled callers.

## ESPN is fetched directly from this container — no external relay

The Cloudflare original this app was ported from could not fetch ESPN's API directly from Worker-side
code — ESPN's edge (Akamai) returns a hard "Access Denied" to Cloudflare's egress IP ranges — so that
version relayed the fetch through a GitHub Actions runner instead (`scripts/sync-espn.mjs` → POST
`/api/sync/ingest`, auth'd via a shared secret). That block is specific to Cloudflare's IP ranges; a
self-hosted container (home server, VPS, etc.) has no such restriction, so this port fetches ESPN
directly: `src/lib/espn-client.ts` does the fetch, `src/lib/sync-runner.ts` hands the raw event data to
`src/lib/game-sync-core.ts` (unchanged from the original — it never had an ESPN fetch in it, only DB
writes), all in-process. There is no external relay, no shared secret, and nothing to configure in
GitHub Actions for basic operation.

`src/cron/index.ts`'s 15-minute tick calls `runEspnSync` directly whenever a game looks like it's in
progress (a cheap database read, `hasGameInProgress`); the admin dashboard's "Sync Now" and "Season
Rollover" buttons (`src/app/admin/actions.ts` → `runEspnSync`/`runSeasonRollover`) call the same
functions synchronously and wait for them to finish, rather than dispatching a workflow and returning
immediately.

## No personal data, no hardcoded secrets — this repo is open source

Every operator-specific value (pool name, site URL, sender email, any real-money buy-in link) is read
from environment variables via `src/lib/site-config.ts` and `src/lib/env.ts`, with generic defaults.
When adding a new feature, don't hardcode a domain, email address, or third-party account identifier —
add an env var with a sensible default instead, the way `POOL_NAME`/`SITE_URL`/`LEAGUESAFE_URL` work.
There are also no GitHub Actions secrets to configure for basic operation (see "ESPN is fetched
directly" above) — don't reintroduce that coupling without a good reason. Never commit `.env`,
`secrets/rclone.conf`, or a populated SQLite file.

## Database

- SQLite (`better-sqlite3`) + Drizzle ORM. Schema: `src/db/schema.ts`.
- Migrations in `drizzle/` are hand-written SQL, applied in filename order by `scripts/migrate.mjs`
  (tracked in a `_migrations` table it creates). `drizzle.config.ts` is wired up for `drizzle-kit
  studio` to browse the local file, **not** for `drizzle-kit generate` to produce new migrations — this
  repo inherited that convention from the Cloudflare original, where `drizzle/meta/`'s stale snapshot
  made `generate`'s output untrustworthy without inspection. Write new migration files by hand,
  following the existing numbered-file convention and `--> statement-breakpoint` separator style.
- `picks_summary` has a real `UNIQUE(user_id, season_type, week_number)` constraint and no year column
  — season rollover (`rolloverSeason` in `game-sync-core.ts`) explicitly archives and rebuilds it so
  next season's "Week 1" doesn't collide with a leftover row under the same key.
- `games.homeTeamId`/`awayTeamId` are FK-constrained against `teams`. ESPN sometimes represents an
  undetermined postseason matchup with a real-but-placeholder team (abbreviation `TBD`, or the
  `AFC`/`NFC` conference pseudo-teams) rather than omitting the team entirely —
  `PLACEHOLDER_TEAM_ABBREVIATIONS` in `game-sync-core.ts` needs to keep excluding these.

## Package manager & commands

npm, not pnpm. `package-lock.json` is the real lockfile.

```bash
npm run dev                     # local dev server (custom server + cron + WS via tsx)
npx tsc --noEmit                 # typecheck (do this before every commit)
npx next build                   # production build (also catches type errors dev mode won't)
docker compose up -d --build     # full stack from source: app + backup sidecar (bring your own reverse proxy)
docker compose up -d             # same, but pulls app's published image (ghcr.io/drollette/pigskinz-docker) instead of building it
```

No automated test suite and no ESLint config committed. Verification is `tsc --noEmit` + `next build` +
manual smoke-testing.

## Product model

Single shared season-long leaderboard — no multi-pool/multi-tenant concept. Every registered,
email-verified user is automatically part of the one competition. `/` (Home) combines season standings,
the current week's leaderboard, and per-game picks/results. Picks are made on
`/picks/[seasonType]/[weekNum]`.

An admin can mark a user `is_active = false` (e.g. dues not paid) from the admin dashboard. This is a
"full pause": the user can still log in and view read-only, but standings/reminders/auto-pick skip
them, and pick/tiebreaker submission is rejected with an explicit error. Reactivating restores
everything immediately; pick history is never touched either way.

## Commit conventions

Prefix every commit subject with one of `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
(optionally `!` for breaking), lowercase after the colon — e.g. `fix: correct season year
classification`. `.github/workflows/ci.yml` lints this on every commit in a PR via commitlint, not just
the PR title.

## Realtime: WebSocket upgrades must be handled in `server.ts`, not a Route Handler

See "Why a custom server run via `tsx`" above. `src/app/api/ws/route.ts` deliberately only handles the
non-upgrade 426 case — moving the upgrade logic into a Route Handler produces a hung request (Next's
runtime eventually kills it), not an error, since the client's handshake never completes but nothing
throws either.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your
training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed
deprecation notices.
