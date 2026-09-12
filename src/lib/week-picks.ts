import {
  getGamesForWeek,
  getTiebreakerGame,
  getTakenTiebreakerValues,
  getUserPicksSummary,
  getAllTiebreakerPredictions,
  hasGameStarted,
} from "@/lib/data";
import { getDb } from "@/lib/env";
import { picks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { User } from "@/db/schema";

/** Shared data-fetching for a week's picks form -- used by both the full
 * Picks page (any week, from the route) and the Home page's side panel
 * (always the current week). */
export async function getWeekPicksData(user: User, seasonType: number, weekNumber: number) {
  const isInactive = user.isActive === false;

  const [games, tiebreakerGame, takenTiebreakerValues, userSummary, allTiebreakerPredictions] =
    await Promise.all([
      getGamesForWeek(seasonType, weekNumber),
      getTiebreakerGame(seasonType, weekNumber),
      getTakenTiebreakerValues(seasonType, weekNumber),
      getUserPicksSummary(user.id, seasonType, weekNumber),
      getAllTiebreakerPredictions(seasonType, weekNumber),
    ]);

  const tiebreakerRevealed = tiebreakerGame ? hasGameStarted(tiebreakerGame.date) : false;

  let userPicks: Record<string, { teamId: string; isCorrect: boolean | null }> = {};
  try {
    const db = getDb();
    const pickResults = await db
      .select()
      .from(picks)
      .where(and(eq(picks.userId, user.id), eq(picks.weekNumber, weekNumber), eq(picks.seasonType, seasonType)));

    userPicks = pickResults.reduce(
      (acc, pick) => {
        acc[pick.gameId] = { teamId: pick.teamId, isCorrect: pick.isCorrect };
        return acc;
      },
      {} as Record<string, { teamId: string; isCorrect: boolean | null }>
    );
  } catch (error) {
    console.error("getWeekPicksData: error fetching picks:", error);
  }

  return {
    isInactive,
    games,
    tiebreakerGame,
    takenTiebreakerValues,
    userSummary,
    allTiebreakerPredictions,
    tiebreakerRevealed,
    userPicks,
  };
}
