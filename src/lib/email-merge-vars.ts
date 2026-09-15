import { and, eq, inArray, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Database } from "@/db";
import {
  getNextUpcomingGame,
  getCurrentWeekFromDb,
  getWeeklyStandings,
  getOverallStandings,
  getTiebreakerGame,
} from "@/lib/data";
import { formatKickoff } from "@/lib/email";
import { getSeasonTypeName } from "@/lib/utils";
import { MERGE_VARIABLE_NAMES, type MergeVariableName } from "@/lib/email-merge-var-names";
import { SITE_URL } from "@/lib/site-config";
import { getWeekResultsSummary, getMostRecentlyCompletedWeek } from "@/lib/week-results";

export type MergeVariables = Record<MergeVariableName, string>;

export { MERGE_VARIABLE_NAMES };

const UNRANKED = "unranked";

/**
 * Resolves {variable} tokens (see MERGE_VARIABLE_NAMES) to a per-recipient
 * value for a batch of users at once, rather than one query per recipient --
 * the shared lookups (next game, standings, league size) are the same
 * handful of queries regardless of how many recipients there are.
 *
 * Rank/points/pick-count fields fall back to "unranked"/"0" for a user with
 * no picks_summary row yet for the current week, or no picks at all this
 * season (getOverallStandings only returns users with totalPicks > 0) --
 * both real, expected states for exactly the audience this is most likely
 * to be used on (players who are missing picks).
 */
export async function getMergeVariablesForUsers(
  db: Database,
  userIds: string[]
): Promise<Map<string, MergeVariables>> {
  const result = new Map<string, MergeVariables>();
  if (userIds.length === 0) return result;

  const [recipients, nextGame, weekInfo, totalPlayersRow, mostRecentCompletedWeek] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds)),
    getNextUpcomingGame(),
    getCurrentWeekFromDb(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.emailVerified, true), eq(users.isActive, true))),
    getMostRecentlyCompletedWeek(db),
  ]);

  const weekResults = mostRecentCompletedWeek
    ? await getWeekResultsSummary(db, mostRecentCompletedWeek.seasonType, mostRecentCompletedWeek.weekNumber)
    : null;

  const nextGameLabel = nextGame ? nextGame.shortName || nextGame.name : "your next game";
  const nextGameStartTime = nextGame ? formatKickoff(nextGame.date) : "TBD";
  const nextGameWeek = nextGame
    ? `${getSeasonTypeName(nextGame.seasonType)} Week ${nextGame.weekNumber}`
    : "TBD";
  const picksUrl = nextGame ? `${SITE_URL}/picks/${nextGame.seasonType}/${nextGame.weekNumber}` : SITE_URL;
  const totalPlayers = String(totalPlayersRow[0]?.count ?? 0);

  const [weeklyStandings, overallStandings, tiebreakerGame] = await Promise.all([
    getWeeklyStandings(weekInfo.seasonType, weekInfo.week),
    getOverallStandings(weekInfo.seasonType),
    getTiebreakerGame(weekInfo.seasonType, weekInfo.week),
  ]);

  const tiebreakerGameLabel = tiebreakerGame
    ? tiebreakerGame.shortName || tiebreakerGame.name
    : "this week's tiebreaker game";
  const tiebreakerGameStartTime = tiebreakerGame ? formatKickoff(tiebreakerGame.date) : "TBD";
  const tiebreakerWeek = `${getSeasonTypeName(weekInfo.seasonType)} Week ${weekInfo.week}`;
  const tiebreakerUrl = `${SITE_URL}/picks/${weekInfo.seasonType}/${weekInfo.week}`;

  const weeklyRankByUser = new Map<string, number>();
  const tiebreakerPredictionByUser = new Map<string, number | null>();
  weeklyStandings.forEach((s, index) => {
    weeklyRankByUser.set(s.user.id, s.summary?.rank ?? index + 1);
    tiebreakerPredictionByUser.set(s.user.id, s.summary?.tiebreakerPrediction ?? null);
  });

  const overallStatsByUser = new Map<string, (typeof overallStandings)[number]>();
  for (const s of overallStandings) {
    overallStatsByUser.set(s.userId, s);
  }

  for (const recipient of recipients) {
    const weeklyRank = weeklyRankByUser.get(recipient.id);
    const overallStats = overallStatsByUser.get(recipient.id);
    const tiebreakerPrediction = tiebreakerPredictionByUser.get(recipient.id);

    result.set(recipient.id, {
      name: recipient.name,
      username: recipient.username ?? recipient.name,
      next_game: nextGameLabel,
      next_game_start_time: nextGameStartTime,
      next_game_week: nextGameWeek,
      picks_url: picksUrl,
      user_current_week_rank: weeklyRank ? String(weeklyRank) : UNRANKED,
      user_overall_rank: overallStats ? String(overallStats.rank) : UNRANKED,
      user_points: overallStats ? String(overallStats.points) : "0",
      user_correct_picks: overallStats ? String(overallStats.correctPicks) : "0",
      user_total_picks: overallStats ? String(overallStats.totalPicks) : "0",
      user_win_rate: overallStats ? `${overallStats.winRate}%` : "0%",
      total_players: totalPlayers,
      site_url: SITE_URL,
      current_week_tiebreaker_game: tiebreakerGameLabel,
      current_week_tiebreaker_game_start_time: tiebreakerGameStartTime,
      current_week_tiebreaker_week: tiebreakerWeek,
      current_week_tiebreaker_url: tiebreakerUrl,
      user_tiebreaker_prediction:
        tiebreakerPrediction !== null && tiebreakerPrediction !== undefined
          ? String(tiebreakerPrediction)
          : "not yet submitted",
      week_results_week: weekResults?.week ?? "",
      week_results_first_place: weekResults?.firstPlace ?? "",
      week_results_second_place: weekResults?.secondPlace ?? "",
      week_results_third_place: weekResults?.thirdPlace ?? "",
      week_results_tiebreaker_winners: weekResults?.tiebreakerWinners ?? "",
    });
  }

  return result;
}

/** Replaces every {variableName} token with its resolved value. Unknown
 * tokens (a typo, or literal curly braces the admin actually meant) are
 * left untouched rather than blanked out. */
export function applyMergeVariables(text: string, vars: MergeVariables): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    return name in vars ? vars[name as MergeVariableName] : match;
  });
}
