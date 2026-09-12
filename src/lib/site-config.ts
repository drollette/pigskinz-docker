// Deployment-specific identity, previously hardcoded to one operator's pool
// name, domain, sender address, and real-money payment link. Every
// self-host sets these via environment variables instead so the default
// checkout of this repo carries no one operator's personal or financial
// details.
//
// NEXT_PUBLIC_-prefixed vars are inlined into the client bundle at build
// time (see next.config.ts / Next.js's env handling) because this module is
// imported from both server code (email.ts) and client components
// (navbar.tsx, login/page.tsx, leaguesafe-link.tsx) -- none of these values
// are secret, just per-deployment branding/links, so that's fine.
export const POOL_NAME = process.env.NEXT_PUBLIC_POOL_NAME ?? "Pigskinz";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export const EMAIL_FROM_ADDRESS =
  process.env.NEXT_PUBLIC_EMAIL_FROM_ADDRESS ?? process.env.EMAIL_FROM_ADDRESS ?? "pigskinz@example.com";
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? POOL_NAME;

// Optional real-money buy-in collection, e.g. a LeagueSafe group link. Left
// unset by default -- the UI and welcome email skip this section entirely
// unless a deployment configures its own.
export const LEAGUESAFE_URL = process.env.NEXT_PUBLIC_LEAGUESAFE_URL ?? "";
export const BUYIN_AMOUNT = process.env.NEXT_PUBLIC_BUYIN_AMOUNT ?? "";
export const BUYIN_DEADLINE = process.env.NEXT_PUBLIC_BUYIN_DEADLINE ?? "";
export const PAYOUT_INFO =
  process.env.NEXT_PUBLIC_PAYOUT_INFO ?? "Ask your pool organizer how this season's payouts are split.";
