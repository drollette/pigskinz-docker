// Relative imports throughout (not the "@/" tsconfig alias) -- this module
// is reachable both from the Next.js app (via email-merge-vars.ts) and from
// worker.ts's own scheduled handler (via week-results-email.ts), and the
// latter is bundled by wrangler directly rather than through Next.js, which
// doesn't resolve "@/" the same way. pick-reminders.ts and auto-picks.ts
// follow the same rule for the same reason.
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { picksSummary, users } from "../db/schema";
import type { Database } from "../db";
import { getSeasonTypeName } from "./utils";

export interface WeekResultsSummary {
  week: string;
  firstPlace: string;
  secondPlace: string;
  thirdPlace: string;
  tiebreakerWinners: string;
}

/**
 * The {week_results_*} merge variables for one (seasonType, weekNumber) --
 * built off picks_summary.rank, which updateWeeklyStandings (see
 * game-sync-core.ts) only ever assigns once every game that week has
 * completed, so this is never called against a week that's only partly
 * decided. Returns null for a week with no ranked picks_summary rows at
 * all (nobody picked, or it hasn't finished), so callers can tell "no
 * results yet" apart from "results, but nobody placed 3rd."
 */
export async function getWeekResultsSummary(
  db: Database,
  seasonType: number,
  weekNumber: number
): Promise<WeekResultsSummary | null> {
  const rows = await db
    .select({
      rank: picksSummary.rank,
      tiebreakerDiff: picksSummary.tiebreakerDiff,
      username: users.username,
      name: users.name,
    })
    .from(picksSummary)
    .innerJoin(users, eq(users.id, picksSummary.userId))
    .where(
      and(
        eq(picksSummary.seasonType, seasonType),
        eq(picksSummary.weekNumber, weekNumber),
        isNotNull(picksSummary.rank)
      )
    );

  if (rows.length === 0) return null;

  const label = (r: { username: string | null; name: string }) => r.username ?? r.name;

  const first = rows.find((r) => r.rank === 1);
  const second = rows.find((r) => r.rank === 2);
  const third = rows.find((r) => r.rank === 3);

  // "Closest tiebreaker" is a separate award from 1st/2nd place (Rules:
  // "+1 point to whoever is closest on the weekly tiebreaker prediction...
  // If multiple players tie for closest, everyone at that distance gets
  // the point") -- so this can overlap with, or differ entirely from,
  // whoever placed 1st/2nd/3rd above.
  let minDiff: number | null = null;
  for (const r of rows) {
    if (r.tiebreakerDiff === null) continue;
    if (minDiff === null || r.tiebreakerDiff < minDiff) minDiff = r.tiebreakerDiff;
  }
  const tiebreakerWinners = minDiff === null ? [] : rows.filter((r) => r.tiebreakerDiff === minDiff);

  return {
    week: `${getSeasonTypeName(seasonType)} Week ${weekNumber}`,
    firstPlace: first ? `${label(first)} (+2)` : "",
    secondPlace: second ? `${label(second)} (+1)` : "",
    thirdPlace: third ? label(third) : "",
    tiebreakerWinners:
      tiebreakerWinners.length === 0
        ? ""
        : tiebreakerWinners.length === 1
          ? `${label(tiebreakerWinners[0])} (+1)`
          : `${tiebreakerWinners.map(label).join(", ")} (+1 each)`,
  };
}

/** The most recently fully-graded (seasonType, weekNumber), for resolving
 * {week_results_*} in an ad-hoc admin broadcast where there's no specific
 * week already in context -- seasonType/weekNumber both increase
 * chronologically (preseason=1, regular=2, postseason=3; weeks count up
 * within each), so the highest ranked pair is also the most recent one. */
export async function getMostRecentlyCompletedWeek(
  db: Database
): Promise<{ seasonType: number; weekNumber: number } | null> {
  const [row] = await db
    .select({ seasonType: picksSummary.seasonType, weekNumber: picksSummary.weekNumber })
    .from(picksSummary)
    .where(isNotNull(picksSummary.rank))
    .orderBy(desc(picksSummary.seasonType), desc(picksSummary.weekNumber))
    .limit(1);
  return row ?? null;
}
