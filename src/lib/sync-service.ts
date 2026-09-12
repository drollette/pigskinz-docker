// Database sync service for NFL data
import { eq, and, inArray } from "drizzle-orm";
import { teams, games, picks } from "@/db/schema";
import type { Database } from "@/db";
import {
  fetchAllTeams,
  fetchWeekSchedule,
  fetchFullSeasonSchedule,
  fetchCurrentWeek,
  fetchLiveGames,
  getMaxWeeksForSeasonType,
  type ParsedTeam,
  type ParsedGameForDb,
} from "./espn-sync";

export interface SyncResult {
  success: boolean;
  message: string;
  stats?: {
    inserted: number;
    updated: number;
    total: number;
  };
}

/**
 * Sync all NFL teams to database
 */
export async function syncTeams(db: Database): Promise<SyncResult> {
  try {
    const espnTeams = await fetchAllTeams();

    let inserted = 0;
    let updated = 0;

    for (const team of espnTeams) {
      const existing = await db
        .select()
        .from(teams)
        .where(eq(teams.id, team.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(teams)
          .set({
            name: team.name,
            abbreviation: team.abbreviation,
            displayName: team.displayName,
            shortDisplayName: team.shortDisplayName,
            color: team.color,
            alternateColor: team.alternateColor,
            logo: team.logo,
          })
          .where(eq(teams.id, team.id));
        updated++;
      } else {
        await db.insert(teams).values(team);
        inserted++;
      }
    }

    return {
      success: true,
      message: `Teams synced successfully`,
      stats: { inserted, updated, total: espnTeams.length },
    };
  } catch (error) {
    console.error("Error syncing teams:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync games for a specific week
 */
export async function syncGamesForWeek(
  db: Database,
  seasonType: number,
  week: number
): Promise<SyncResult> {
  try {
    const espnGames = await fetchWeekSchedule(seasonType, week);

    let inserted = 0;
    let updated = 0;

    for (const game of espnGames) {
      const existing = await db
        .select()
        .from(games)
        .where(eq(games.id, game.id))
        .limit(1);

      const wasCompleted = existing[0]?.completed ?? false;

      if (existing.length > 0) {
        await db
          .update(games)
          .set({
            name: game.name,
            shortName: game.shortName,
            date: game.date,
            seasonType: game.seasonType,
            weekNumber: game.weekNumber,
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
            homeTeamScore: game.homeTeamScore,
            awayTeamScore: game.awayTeamScore,
            completed: game.completed,
            statusName: game.statusName,
            odds: game.odds,
            overUnder: game.overUnder,
            updatedAt: new Date(),
          })
          .where(eq(games.id, game.id));
        updated++;
      } else {
        await db.insert(games).values({
          ...game,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        inserted++;
      }

      // If game just completed, calculate pick results
      if (game.completed && !wasCompleted) {
        await calculatePickResults(db, game.id);
      }
    }

    return {
      success: true,
      message: `Week ${week} (season type ${seasonType}) synced`,
      stats: { inserted, updated, total: espnGames.length },
    };
  } catch (error) {
    console.error(`Error syncing week ${week}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync full season schedule
 */
export async function syncFullSeason(db: Database): Promise<SyncResult> {
  try {
    // First sync teams (required for FK constraints if we add them back)
    const teamsResult = await syncTeams(db);
    if (!teamsResult.success) {
      return teamsResult;
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalGames = 0;

    // Sync all season types
    const seasonTypes = [1, 2, 3]; // Preseason, Regular, Postseason

    for (const seasonType of seasonTypes) {
      const maxWeeks = getMaxWeeksForSeasonType(seasonType);

      for (let week = 1; week <= maxWeeks; week++) {
        const result = await syncGamesForWeek(db, seasonType, week);
        if (result.stats) {
          totalInserted += result.stats.inserted;
          totalUpdated += result.stats.updated;
          totalGames += result.stats.total;
        }
      }
    }

    return {
      success: true,
      message: `Full season synced: ${totalGames} games`,
      stats: { inserted: totalInserted, updated: totalUpdated, total: totalGames },
    };
  } catch (error) {
    console.error("Error syncing full season:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update scores for current week (live updates)
 */
export async function updateCurrentWeekScores(db: Database): Promise<SyncResult> {
  try {
    const current = await fetchCurrentWeek();
    return syncGamesForWeek(db, current.seasonType, current.week);
  } catch (error) {
    console.error("Error updating current week scores:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update scores for a specific week
 */
export async function updateWeekScores(
  db: Database,
  seasonType: number,
  week: number
): Promise<SyncResult> {
  try {
    return syncGamesForWeek(db, seasonType, week);
  } catch (error) {
    console.error(`Error updating scores for week ${week}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate and update pick results when a game completes
 */
export async function calculatePickResults(
  db: Database,
  gameId: string
): Promise<void> {
  try {
    // Get the completed game
    const gameResult = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    const game = gameResult[0];
    if (!game || !game.completed) {
      return;
    }

    // Determine the winning team
    let winningTeamId: string | null = null;
    if (game.homeTeamScore !== null && game.awayTeamScore !== null) {
      if (game.homeTeamScore > game.awayTeamScore) {
        winningTeamId = game.homeTeamId;
      } else if (game.awayTeamScore > game.homeTeamScore) {
        winningTeamId = game.awayTeamId;
      }
      // If scores are equal, it's a tie - no winner
    }

    // Get all picks for this game
    const gamePicks = await db
      .select()
      .from(picks)
      .where(eq(picks.gameId, gameId));

    // Update each pick with the result
    for (const pick of gamePicks) {
      const isCorrect = winningTeamId ? pick.teamId === winningTeamId : null;

      await db
        .update(picks)
        .set({
          isCorrect,
          updatedAt: new Date(),
        })
        .where(eq(picks.id, pick.id));
    }

    console.log(
      `Calculated results for ${gamePicks.length} picks on game ${gameId}`
    );
  } catch (error) {
    console.error(`Error calculating pick results for game ${gameId}:`, error);
  }
}

/**
 * Recalculate all pick results for completed games
 * Useful for fixing historical data
 */
export async function recalculateAllPickResults(db: Database): Promise<SyncResult> {
  try {
    // Get all completed games
    const completedGames = await db
      .select()
      .from(games)
      .where(eq(games.completed, true));

    for (const game of completedGames) {
      await calculatePickResults(db, game.id);
    }

    return {
      success: true,
      message: `Recalculated picks for ${completedGames.length} completed games`,
      stats: { inserted: 0, updated: completedGames.length, total: completedGames.length },
    };
  } catch (error) {
    console.error("Error recalculating pick results:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Main cron job handler
 * Runs every 5 minutes to update scores and verify schedule
 */
export async function runScheduledSync(db: Database): Promise<SyncResult> {
  try {
    const current = await fetchCurrentWeek();

    // Update current week scores
    const scoreResult = await updateCurrentWeekScores(db);
    console.log(`Score update: ${scoreResult.message}`);

    // Also sync adjacent weeks to catch schedule changes
    // (previous week for recently completed games, next week for newly scheduled games)
    const maxWeeks = getMaxWeeksForSeasonType(current.seasonType);

    if (current.week > 1) {
      await syncGamesForWeek(db, current.seasonType, current.week - 1);
    }

    if (current.week < maxWeeks) {
      await syncGamesForWeek(db, current.seasonType, current.week + 1);
    }

    return {
      success: true,
      message: `Scheduled sync completed for week ${current.week}`,
    };
  } catch (error) {
    console.error("Error in scheduled sync:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
