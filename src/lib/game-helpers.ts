// Pure, DB-free helpers safe to import from client components. Split out of
// data.ts because data.ts's top-level `getDb` import chain now pulls in
// better-sqlite3 (a native, Node-only module) -- fine for server code, but
// it broke client bundling the moment a "use client" component
// (results-game-list.tsx) imported a *value* (not just a type) from data.ts,
// since bundlers can't tree-shake away a CommonJS `require("fs")` even when
// the importing code never calls it. D1's driver never had this problem
// (no native bindings), so this split wasn't needed in the Cloudflare
// original this app was ported from.

/** Check if a game has started (date is in the past) */
export function hasGameStarted(gameDate: Date): boolean {
  return new Date() >= gameDate;
}
