// Database-backed data access layer
// Reads from the local SQLite database instead of the ESPN API

import { getDb } from "@/lib/env";
import { games, teams, picksSummary, picks, users, siteSettings, chatMessages } from "@/db/schema";
import { eq, and, or, gt, desc, asc, sql, inArray, isNotNull } from "drizzle-orm";
import {
  computeNFLStandings,
  groupStandingsByDivision,
  computePlayoffSeeding,
  type StandingsByDivision,
  type PlayoffSeed,
} from "@/lib/nfl-standings";
import type { Conference } from "@/lib/nfl-divisions";
import { hasGameStarted } from "@/lib/game-helpers";

// Re-exported for existing callers -- see game-helpers.ts for why client
// components must import this from there directly instead of from here.
export { hasGameStarted };

// site_settings only ever has this one row.
export const SITE_SETTINGS_ID = "singleton";

/** The admin-editable message shown on the Home page, or null if unset. */
export async function getHomeMessage(): Promise<string | null> {
  const db = getDb();
  const result = await db
    .select({ homeMessage: siteSettings.homeMessage })
    .from(siteSettings)
    .where(eq(siteSettings.id, SITE_SETTINGS_ID))
    .limit(1);
  return result[0]?.homeMessage ?? null;
}

/** The admin-editable subject/body template the automated week-results
 * email (src/lib/week-results-email.ts) sends from -- either can be unset,
 * in which case that sender just skips sending until an admin sets both. */
export async function getWeekResultsEmailTemplate(): Promise<{ subject: string; body: string } | null> {
  const db = getDb();
  const result = await db
    .select({
      subject: siteSettings.weekResultsEmailSubject,
      body: siteSettings.weekResultsEmailBody,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, SITE_SETTINGS_ID))
    .limit(1);
  const row = result[0];
  if (!row?.subject || !row?.body) return null;
  return { subject: row.subject, body: row.body };
}

export interface MissingPickUser {
  id: string;
  name: string;
  email: string;
}

export interface NextGameSummary {
  id: string;
  name: string;
  shortName: string | null;
  date: Date;
  seasonType: number;
  weekNumber: number;
}

export interface NextGameMissingPicks {
  game: NextGameSummary;
  missingUsers: MissingPickUser[];
}

/**
 * The soonest not-yet-started, not-completed game, or null when there's
 * none scheduled. Shared by getNextGameMissingPicks (below) and the email
 * merge-variable resolver (email-merge-vars.ts), which only needs the game
 * itself, not who's missing a pick for it.
 */
export async function getNextUpcomingGame(): Promise<NextGameSummary | null> {
  const db = getDb();
  const now = new Date();

  const [nextGame] = await db
    .select({
      id: games.id,
      name: games.name,
      shortName: games.shortName,
      date: games.date,
      seasonType: games.seasonType,
      weekNumber: games.weekNumber,
    })
    .from(games)
    .where(and(eq(games.completed, false), gt(games.date, now)))
    .orderBy(asc(games.date))
    .limit(1);

  return nextGame ?? null;
}

/**
 * The soonest not-yet-started, not-completed game, plus every active,
 * email-verified user who hasn't picked it yet. Used by the admin
 * dashboard's "Missing Picks" panel so an admin can nudge stragglers
 * without waiting on the automated same-day reminder (sendPickReminders in
 * pick-reminders.ts, which only fires once per user per day and only for
 * games kicking off later that same US Eastern calendar day). Returns null
 * when there's no upcoming game to check.
 */
export async function getNextGameMissingPicks(): Promise<NextGameMissingPicks | null> {
  const db = getDb();
  const nextGame = await getNextUpcomingGame();

  if (!nextGame) return null;

  const [eligibleUsers, existingPicks] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.emailVerified, true), eq(users.isActive, true))),
    db
      .select({ userId: picks.userId })
      .from(picks)
      .where(eq(picks.gameId, nextGame.id)),
  ]);

  const pickedUserIds = new Set(existingPicks.map((p) => p.userId));
  const missingUsers = eligibleUsers.filter((u) => !pickedUserIds.has(u.id));

  return { game: nextGame, missingUsers };
}

export interface MissingTiebreakerUser {
  id: string;
  name: string;
  email: string;
}

export interface CurrentWeekMissingTiebreaker {
  game: NextGameSummary;
  missingUsers: MissingTiebreakerUser[];
}

/**
 * The current week's tiebreaker game, plus every active, email-verified
 * user who hasn't submitted a tiebreaker prediction for it yet. Mirrors
 * getNextGameMissingPicks above but scoped to the tiebreaker specifically
 * (a once-per-week thing, unlike individual game picks), and returns null
 * once that game has started -- there's nothing left for an admin to nudge
 * once the tiebreaker is locked.
 */
export async function getCurrentWeekMissingTiebreaker(): Promise<CurrentWeekMissingTiebreaker | null> {
  const db = getDb();
  const weekInfo = await getCurrentWeekFromDb();
  const tiebreakerGame = await getTiebreakerGame(weekInfo.seasonType, weekInfo.week);

  if (!tiebreakerGame || hasGameStarted(tiebreakerGame.date)) return null;

  const [eligibleUsers, existingSummaries] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.emailVerified, true), eq(users.isActive, true))),
    db
      .select({ userId: picksSummary.userId, tiebreakerPrediction: picksSummary.tiebreakerPrediction })
      .from(picksSummary)
      .where(
        and(
          eq(picksSummary.seasonType, weekInfo.seasonType),
          eq(picksSummary.weekNumber, weekInfo.week)
        )
      ),
  ]);

  const submittedUserIds = new Set(
    existingSummaries.filter((s) => s.tiebreakerPrediction !== null).map((s) => s.userId)
  );
  const missingUsers = eligibleUsers.filter((u) => !submittedUserIds.has(u.id));

  return {
    game: {
      id: tiebreakerGame.id,
      name: tiebreakerGame.name,
      shortName: tiebreakerGame.shortName,
      date: tiebreakerGame.date,
      seasonType: weekInfo.seasonType,
      weekNumber: weekInfo.week,
    },
    missingUsers,
  };
}

export interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string | null;
  color: string | null;
  alternateColor: string | null;
  logo: string | null;
  score: number | null;
  isWinner?: boolean;
}

export interface GameData {
  id: string;
  name: string;
  shortName: string;
  date: Date;
  statusName: string;
  completed: boolean;
  weekNumber?: number;
  seasonType?: number;
  homeTeam: TeamData;
  awayTeam: TeamData;
  odds: string;
  overUnder: number | null;
}

export interface WeekInfo {
  week: number;
  seasonType: number;
  year: number;
}

/**
 * Get current week info from the database
 * Determines current week based on games with the most recent dates
 */
export async function getCurrentWeekFromDb(): Promise<WeekInfo> {
  const db = getDb();

  const now = new Date();

  // Find the most recent week with games that includes today or upcoming games
  // First, try to find games from today or future
  const upcomingGame = await db
    .select({
      weekNumber: games.weekNumber,
      seasonType: games.seasonType,
    })
    .from(games)
    .where(and(
      eq(games.completed, false)
    ))
    .orderBy(games.date)
    .limit(1);

  if (upcomingGame.length > 0) {
    return {
      week: upcomingGame[0].weekNumber,
      seasonType: upcomingGame[0].seasonType,
      year: now.getFullYear(),
    };
  }

  // If no upcoming games, get the most recently completed week
  const recentGame = await db
    .select({
      weekNumber: games.weekNumber,
      seasonType: games.seasonType,
    })
    .from(games)
    .orderBy(desc(games.date))
    .limit(1);

  if (recentGame.length > 0) {
    return {
      week: recentGame[0].weekNumber,
      seasonType: recentGame[0].seasonType,
      year: now.getFullYear(),
    };
  }

  // Default fallback
  return {
    week: 1,
    seasonType: 2, // Regular season
    year: now.getFullYear(),
  };
}

/**
 * Kickoff of the earliest regular-season game — also the buy-in deadline,
 * so this is what the Home page countdown counts down to. Returns null if
 * the regular-season schedule hasn't been synced yet.
 */
export async function getFirstRegularSeasonGameDate(): Promise<Date | null> {
  const db = getDb();

  const result = await db
    .select({ date: games.date })
    .from(games)
    .where(eq(games.seasonType, 2))
    .orderBy(asc(games.date))
    .limit(1);

  return result[0]?.date ?? null;
}

/**
 * Get games for a specific week from the database
 */
export async function getGamesForWeek(
  seasonType: number,
  weekNumber: number
): Promise<GameData[]> {
  const db = getDb();

  // Fetch games with team data
  const gamesData = await db
    .select({
      game: games,
      homeTeam: teams,
    })
    .from(games)
    .innerJoin(teams, eq(games.homeTeamId, teams.id))
    .where(
      and(
        eq(games.seasonType, seasonType),
        eq(games.weekNumber, weekNumber)
      )
    )
    .orderBy(games.date);

  // Need to also fetch away teams
  const gameIds = gamesData.map(g => g.game.id);

  if (gameIds.length === 0) {
    return [];
  }

  // Fetch all away teams for these games
  const allTeams = await db.select().from(teams);
  const teamsMap = new Map(allTeams.map(t => [t.id, t]));

  return gamesData.map(({ game }) => {
    const homeTeam = teamsMap.get(game.homeTeamId);
    const awayTeam = teamsMap.get(game.awayTeamId);

    if (!homeTeam || !awayTeam) {
      throw new Error(`Missing team data for game ${game.id}`);
    }

    // Determine winner if game is completed
    let homeIsWinner: boolean | undefined;
    let awayIsWinner: boolean | undefined;

    if (game.completed && game.homeTeamScore !== null && game.awayTeamScore !== null) {
      homeIsWinner = game.homeTeamScore > game.awayTeamScore;
      awayIsWinner = game.awayTeamScore > game.homeTeamScore;
    }

    return {
      id: game.id,
      name: game.name,
      shortName: game.shortName || game.name,
      date: game.date,
      statusName: game.statusName || "STATUS_SCHEDULED",
      completed: game.completed || false,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        abbreviation: homeTeam.abbreviation,
        displayName: homeTeam.displayName,
        shortDisplayName: homeTeam.shortDisplayName,
        color: homeTeam.color,
        alternateColor: homeTeam.alternateColor,
        logo: homeTeam.logo,
        score: game.homeTeamScore,
        isWinner: homeIsWinner,
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        abbreviation: awayTeam.abbreviation,
        displayName: awayTeam.displayName,
        shortDisplayName: awayTeam.shortDisplayName,
        color: awayTeam.color,
        alternateColor: awayTeam.alternateColor,
        logo: awayTeam.logo,
        score: game.awayTeamScore,
        isWinner: awayIsWinner,
      },
      odds: game.odds || "Odds Not Available",
      overUnder: game.overUnder,
    };
  });
}

/**
 * Get all teams from the database
 */
export async function getAllTeams() {
  const db = getDb();
  return db.select().from(teams);
}

/**
 * Get all games for a specific team, grouped by season type
 */
export async function getGamesForTeam(teamId: string): Promise<{
  preseason: GameData[];
  regularSeason: GameData[];
  postseason: GameData[];
}> {
  const db = getDb();

  // Fetch all games where team is home or away
  const gamesData = await db
    .select()
    .from(games)
    .where(
      or(
        eq(games.homeTeamId, teamId),
        eq(games.awayTeamId, teamId)
      )
    )
    .orderBy(games.seasonType, games.weekNumber, games.date);

  // Fetch all teams for mapping
  const allTeams = await db.select().from(teams);
  const teamsMap = new Map(allTeams.map(t => [t.id, t]));

  const mapGame = (game: typeof gamesData[0]): GameData => {
    const homeTeam = teamsMap.get(game.homeTeamId);
    const awayTeam = teamsMap.get(game.awayTeamId);

    if (!homeTeam || !awayTeam) {
      throw new Error(`Missing team data for game ${game.id}`);
    }

    let homeIsWinner: boolean | undefined;
    let awayIsWinner: boolean | undefined;

    if (game.completed && game.homeTeamScore !== null && game.awayTeamScore !== null) {
      homeIsWinner = game.homeTeamScore > game.awayTeamScore;
      awayIsWinner = game.awayTeamScore > game.homeTeamScore;
    }

    return {
      id: game.id,
      name: game.name,
      shortName: game.shortName || game.name,
      date: game.date,
      statusName: game.statusName || "STATUS_SCHEDULED",
      completed: game.completed || false,
      weekNumber: game.weekNumber,
      seasonType: game.seasonType,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        abbreviation: homeTeam.abbreviation,
        displayName: homeTeam.displayName,
        shortDisplayName: homeTeam.shortDisplayName,
        color: homeTeam.color,
        alternateColor: homeTeam.alternateColor,
        logo: homeTeam.logo,
        score: game.homeTeamScore,
        isWinner: homeIsWinner,
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        abbreviation: awayTeam.abbreviation,
        displayName: awayTeam.displayName,
        shortDisplayName: awayTeam.shortDisplayName,
        color: awayTeam.color,
        alternateColor: awayTeam.alternateColor,
        logo: awayTeam.logo,
        score: game.awayTeamScore,
        isWinner: awayIsWinner,
      },
      odds: game.odds || "Odds Not Available",
      overUnder: game.overUnder,
    };
  };

  const preseason: GameData[] = [];
  const regularSeason: GameData[] = [];
  const postseason: GameData[] = [];

  for (const game of gamesData) {
    const mappedGame = mapGame(game);
    if (game.seasonType === 1) {
      preseason.push(mappedGame);
    } else if (game.seasonType === 2) {
      regularSeason.push(mappedGame);
    } else if (game.seasonType === 3) {
      postseason.push(mappedGame);
    }
  }

  return { preseason, regularSeason, postseason };
}

/**
 * Get a single team by ID
 */
export async function getTeamById(teamId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return result[0] || null;
}

/**
 * Get a single game by ID with team data
 */
export async function getGameById(gameId: string): Promise<GameData | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const game = result[0];
  const allTeams = await db.select().from(teams);
  const teamsMap = new Map(allTeams.map(t => [t.id, t]));

  const homeTeam = teamsMap.get(game.homeTeamId);
  const awayTeam = teamsMap.get(game.awayTeamId);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  let homeIsWinner: boolean | undefined;
  let awayIsWinner: boolean | undefined;

  if (game.completed && game.homeTeamScore !== null && game.awayTeamScore !== null) {
    homeIsWinner = game.homeTeamScore > game.awayTeamScore;
    awayIsWinner = game.awayTeamScore > game.homeTeamScore;
  }

  return {
    id: game.id,
    name: game.name,
    shortName: game.shortName || game.name,
    date: game.date,
    statusName: game.statusName || "STATUS_SCHEDULED",
    completed: game.completed || false,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      displayName: homeTeam.displayName,
      shortDisplayName: homeTeam.shortDisplayName,
      color: homeTeam.color,
      alternateColor: homeTeam.alternateColor,
      logo: homeTeam.logo,
      score: game.homeTeamScore,
      isWinner: homeIsWinner,
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      displayName: awayTeam.displayName,
      shortDisplayName: awayTeam.shortDisplayName,
      color: awayTeam.color,
      alternateColor: awayTeam.alternateColor,
      logo: awayTeam.logo,
      score: game.awayTeamScore,
      isWinner: awayIsWinner,
    },
    odds: game.odds || "Odds Not Available",
    overUnder: game.overUnder,
  };
}

/**
 * Get the tiebreaker game for a week (last scheduled game)
 */
export async function getTiebreakerGame(
  seasonType: number,
  weekNumber: number
): Promise<GameData | null> {
  const db = getDb();

  // Get the last game of the week by date
  const result = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.seasonType, seasonType),
        eq(games.weekNumber, weekNumber)
      )
    )
    .orderBy(desc(games.date))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const game = result[0];
  const allTeams = await db.select().from(teams);
  const teamsMap = new Map(allTeams.map(t => [t.id, t]));

  const homeTeam = teamsMap.get(game.homeTeamId);
  const awayTeam = teamsMap.get(game.awayTeamId);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  let homeIsWinner: boolean | undefined;
  let awayIsWinner: boolean | undefined;

  if (game.completed && game.homeTeamScore !== null && game.awayTeamScore !== null) {
    homeIsWinner = game.homeTeamScore > game.awayTeamScore;
    awayIsWinner = game.awayTeamScore > game.homeTeamScore;
  }

  return {
    id: game.id,
    name: game.name,
    shortName: game.shortName || game.name,
    date: game.date,
    statusName: game.statusName || "STATUS_SCHEDULED",
    completed: game.completed || false,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbreviation,
      displayName: homeTeam.displayName,
      shortDisplayName: homeTeam.shortDisplayName,
      color: homeTeam.color,
      alternateColor: homeTeam.alternateColor,
      logo: homeTeam.logo,
      score: game.homeTeamScore,
      isWinner: homeIsWinner,
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbreviation,
      displayName: awayTeam.displayName,
      shortDisplayName: awayTeam.shortDisplayName,
      color: awayTeam.color,
      alternateColor: awayTeam.alternateColor,
      logo: awayTeam.logo,
      score: game.awayTeamScore,
      isWinner: awayIsWinner,
    },
    odds: game.odds || "Odds Not Available",
    overUnder: game.overUnder,
  };
}

/**
 * Get taken tiebreaker predictions for a week (to prevent duplicates)
 */
export async function getTakenTiebreakerValues(
  seasonType: number,
  weekNumber: number,
  excludeUserId?: string
): Promise<number[]> {
  const db = getDb();

  let query = db
    .select({ prediction: picksSummary.tiebreakerPrediction })
    .from(picksSummary)
    .where(
      and(
        eq(picksSummary.seasonType, seasonType),
        eq(picksSummary.weekNumber, weekNumber)
      )
    );

  const results = await query;

  // Filter out nulls and the excluded user's prediction
  return results
    .filter(r => r.prediction !== null)
    .map(r => r.prediction as number);
}

/**
 * Every submitted tiebreaker prediction for a week, with the predicting
 * user attached. The caller decides when it's safe to show this to anyone
 * other than the predicting user themself (normally: once the tiebreaker
 * game has started) — this just returns the data.
 */
export async function getAllTiebreakerPredictions(seasonType: number, weekNumber: number) {
  const db = getDb();

  const results = await db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      avatar: users.avatar,
      prediction: picksSummary.tiebreakerPrediction,
      diff: picksSummary.tiebreakerDiff,
    })
    .from(picksSummary)
    .innerJoin(users, eq(picksSummary.userId, users.id))
    .where(
      and(
        eq(picksSummary.seasonType, seasonType),
        eq(picksSummary.weekNumber, weekNumber),
        isNotNull(picksSummary.tiebreakerPrediction)
      )
    )
    .orderBy(asc(picksSummary.tiebreakerPrediction));

  return results;
}

/**
 * Get user's picks summary for a week
 */
export async function getUserPicksSummary(
  userId: string,
  seasonType: number,
  weekNumber: number
) {
  const db = getDb();

  const result = await db
    .select()
    .from(picksSummary)
    .where(
      and(
        eq(picksSummary.userId, userId),
        eq(picksSummary.seasonType, seasonType),
        eq(picksSummary.weekNumber, weekNumber)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Get weekly standings with user info (all users ranked)
 */
export async function getWeeklyStandings(
  seasonType: number,
  weekNumber: number
) {
  const db = getDb();

  // Starts from users (LEFT JOIN picks_summary), not the other way around --
  // a user who hasn't made a single pick yet this week has no picks_summary
  // row at all (that row is only ever created once updateWeeklyStandings
  // runs, which itself only fires when a game completes -- see
  // game-sync-core.ts). Joining the other direction silently dropped anyone
  // in that state instead of showing them at 0 correct / 0 picked.
  const results = await db
    .select({
      summary: {
        id: picksSummary.id,
        correctPicksCount: sql<number>`COALESCE(${picksSummary.correctPicksCount}, 0)`,
        totalPicksCount: sql<number>`COALESCE(${picksSummary.totalPicksCount}, 0)`,
        tiebreakerPrediction: picksSummary.tiebreakerPrediction,
        tiebreakerSubmittedAt: picksSummary.tiebreakerSubmittedAt,
        tiebreakerActual: picksSummary.tiebreakerActual,
        tiebreakerDiff: picksSummary.tiebreakerDiff,
        rank: picksSummary.rank,
      },
      user: {
        id: users.id,
        name: users.name,
        username: users.username,
      },
    })
    .from(users)
    .leftJoin(
      picksSummary,
      and(
        eq(picksSummary.userId, users.id),
        eq(picksSummary.seasonType, seasonType),
        eq(picksSummary.weekNumber, weekNumber)
      )
    )
    .where(eq(users.isActive, true))
    .orderBy(
      desc(sql`COALESCE(${picksSummary.correctPicksCount}, 0)`),
      asc(picksSummary.tiebreakerDiff),
      // A user who hasn't submitted a tiebreaker guess at all has a NULL
      // tiebreakerSubmittedAt -- SQLite's default ASC ordering sorts NULLs
      // first, which would rank "never submitted a guess" ahead of everyone
      // who actually did. Push NULLs to the back so only real submission
      // times compete for "who guessed first."
      sql`${picksSummary.tiebreakerSubmittedAt} IS NULL`,
      asc(picksSummary.tiebreakerSubmittedAt)
    );

  return results;
}

/**
 * Get all picks for a week with user info
 * Used for the results page to show who picked what
 */
export async function getAllPicksForWeek(
  seasonType: number,
  weekNumber: number
) {
  const db = getDb();

  const results = await db
    .select({
      pick: picks,
      user: {
        id: users.id,
        name: users.name,
        username: users.username,
        avatar: users.avatar,
      },
    })
    .from(picks)
    .innerJoin(users, eq(picks.userId, users.id))
    .where(
      and(
        eq(picks.seasonType, seasonType),
        eq(picks.weekNumber, weekNumber)
      )
    );

  return results;
}


/**
 * Get available weeks that have games/picks
 */
export async function getAvailableWeeks(): Promise<
  { seasonType: number; weekNumber: number }[]
> {
  const db = getDb();

  const weeks = await db
    .selectDistinct({
      seasonType: picksSummary.seasonType,
      weekNumber: picksSummary.weekNumber,
    })
    .from(picksSummary)
    .orderBy(desc(picksSummary.seasonType), desc(picksSummary.weekNumber));

  return weeks;
}

/**
 * Get overall standings with comprehensive statistics, scoped to a single
 * season type (preseason/regular/postseason picks are tracked separately —
 * without this filter, e.g. preseason picks would stay blended into the
 * "season" leaderboard forever once the regular season starts).
 */
export async function getOverallStandings(seasonType: number) {
  const db = getDb();

  const userStats = await db
    .select({
      userId: users.id,
      userName: users.name,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(and(eq(users.emailVerified, true), eq(users.isActive, true)));

  const userIds = userStats.map((u) => u.userId);
  if (userIds.length === 0) return [];

  // All picks and all weekly summaries for every user, fetched in bulk
  // rather than per-user, since points now require cross-user comparison
  // (the closest-tiebreaker bonus needs each week's minimum distance across
  // everyone, not just one user at a time).
  const [allUserPicks, allSummaries, gradedGamesByWeek] = await Promise.all([
    db
      .select({ userId: picks.userId, isCorrect: picks.isCorrect })
      .from(picks)
      .innerJoin(games, eq(picks.gameId, games.id))
      .where(and(inArray(picks.userId, userIds), eq(picks.seasonType, seasonType))),
    db
      .select({
        userId: picksSummary.userId,
        weekNumber: picksSummary.weekNumber,
        correctPicksCount: picksSummary.correctPicksCount,
        totalPicksCount: picksSummary.totalPicksCount,
        tiebreakerDiff: picksSummary.tiebreakerDiff,
        rank: picksSummary.rank,
      })
      .from(picksSummary)
      .where(and(inArray(picksSummary.userId, userIds), eq(picksSummary.seasonType, seasonType))),
    // Every completed game this season, by week -- the shared denominator
    // for win rate below. A skipped pick isn't graded "correct," but it was
    // still a real game everyone else got a shot at, so it has to count
    // against a player's percentage the same as a wrong pick would; using
    // each player's own picked-game count as the denominator instead let
    // someone who skipped games post a HIGHER percentage than someone who
    // picked every game and got the same number right, since the misses
    // just shrank their own denominator instead of counting against them.
    db
      .select({ weekNumber: games.weekNumber, count: sql<number>`count(*)` })
      .from(games)
      .where(and(eq(games.seasonType, seasonType), eq(games.completed, true)))
      .groupBy(games.weekNumber),
  ]);

  const gradedGamesCountByWeek = new Map<number, number>();
  let totalGradedGames = 0;
  for (const row of gradedGamesByWeek) {
    gradedGamesCountByWeek.set(row.weekNumber, row.count);
    totalGradedGames += row.count;
  }

  // Closest tiebreaker guess of each week, among everyone who submitted one --
  // restricted to weeks that are actually fully graded (picksSummary.rank is
  // only ever non-null once every game that week has completed, see
  // updateWeeklyStandings in game-sync-core.ts) so this bonus doesn't pay out
  // for a week's tiebreaker game the moment it happens to finish, while the
  // rest of that week's games -- and thus who actually wins the week -- are
  // still undecided. Same reasoning as the weeklyFirsts/weeklySeconds bonus
  // below, just keyed off the same "rank" signal instead of a second query.
  const closestDiffByWeek = new Map<number, number>();
  for (const s of allSummaries) {
    if (s.tiebreakerDiff === null || s.rank === null) continue;
    const current = closestDiffByWeek.get(s.weekNumber);
    if (current === undefined || s.tiebreakerDiff < current) {
      closestDiffByWeek.set(s.weekNumber, s.tiebreakerDiff);
    }
  }

  const picksByUser = new Map<string, typeof allUserPicks>();
  for (const p of allUserPicks) {
    const list = picksByUser.get(p.userId);
    if (list) list.push(p);
    else picksByUser.set(p.userId, [p]);
  }

  const summariesByUser = new Map<string, typeof allSummaries>();
  for (const s of allSummaries) {
    const list = summariesByUser.get(s.userId);
    if (list) list.push(s);
    else summariesByUser.set(s.userId, [s]);
  }

  const standings = userStats.map((user) => {
    const userPicks = picksByUser.get(user.userId) ?? [];
    const userSummaries = summariesByUser.get(user.userId) ?? [];

    const totalPicks = userPicks.length;
    const correctPicks = userPicks.filter((p) => p.isCorrect === true).length;
    const incorrectPicks = userPicks.filter((p) => p.isCorrect === false).length;
    const pendingPicks = userPicks.filter((p) => p.isCorrect === null).length;
    // Against every graded game this season, not just the ones this player
    // actually picked -- see the query comment above.
    const winRate = totalGradedGames > 0 ? (correctPicks / totalGradedGames) * 100 : 0;

    // Weekly-rank bonuses. updateWeeklyStandings assigns rank as a strict
    // sequential order (no ties, thanks to tiebreakerSubmittedAt breaking
    // any remaining tie), so there's exactly one 1st and one 2nd per week.
    const weeklyFirsts = userSummaries.filter((s) => s.rank === 1).length;
    const weeklySeconds = userSummaries.filter((s) => s.rank === 2).length;

    // Closest-tiebreaker bonus: +1 for every week this user's guess tied
    // the smallest distance from the actual score that week — everyone
    // tied at the minimum gets it, not just one of them.
    const closestTiebreakers = userSummaries.filter(
      (s) => s.tiebreakerDiff !== null && s.tiebreakerDiff === closestDiffByWeek.get(s.weekNumber)
    ).length;

    const points = correctPicks + weeklyFirsts * 2 + weeklySeconds * 1 + closestTiebreakers * 1;

    const completedWeeks = userSummaries.filter(
      (s) => s.correctPicksCount !== null && s.totalPicksCount && s.totalPicksCount > 0
    );

    let bestWeek = null;
    let worstWeek = null;

    if (completedWeeks.length > 0) {
      const weekPerformances = completedWeeks.map((w) => {
        // Same fix as the season-long win rate above: against every game
        // graded that week, not just the ones this player picked.
        const gradedThisWeek = gradedGamesCountByWeek.get(w.weekNumber) ?? 0;
        return {
          seasonType,
          weekNumber: w.weekNumber,
          correct: w.correctPicksCount ?? 0,
          total: w.totalPicksCount ?? 0,
          percentage: gradedThisWeek > 0 ? ((w.correctPicksCount ?? 0) / gradedThisWeek) * 100 : 0,
        };
      });

      bestWeek = weekPerformances.reduce((best, current) =>
        current.percentage > best.percentage ? current : best
      );
      worstWeek = weekPerformances.reduce((worst, current) =>
        current.percentage < worst.percentage ? current : worst
      );
    }

    return {
      userId: user.userId,
      userName: user.userName,
      username: user.username,
      avatar: user.avatar,
      points,
      totalPicks,
      correctPicks,
      incorrectPicks,
      pendingPicks,
      // Same shared value on every row -- the season-to-date denominator
      // behind winRate, and what the UI shows as "of N" next to it so the
      // two numbers never disagree (see season-standings-table.tsx).
      totalGradedGames,
      winRate: Math.round(winRate * 10) / 10,
      weeklyFirsts,
      weeklySeconds,
      closestTiebreakers,
      bestWeek,
      worstWeek,
      weeksPlayed: completedWeeks.length,
    };
  });

  // Points is the headline ranking stat now — it already folds in weekly
  // 1st/2nd and closest-tiebreaker bonuses on top of 1 point per correct
  // pick. Win rate (raw accuracy) only breaks a tie in total points.
  return standings
    .filter((s) => s.totalPicks > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.winRate - a.winRate;
    })
    .map((s, index) => ({ ...s, rank: index + 1 }));
}

/**
 * Get weekly performance data for charts
 */
export async function getWeeklyPerformanceData() {
  const db = getDb();

  // Get all week summaries grouped by week
  const summaries = await db
    .select({
      userId: picksSummary.userId,
      userName: users.name,
      seasonType: picksSummary.seasonType,
      weekNumber: picksSummary.weekNumber,
      correctPicks: picksSummary.correctPicksCount,
      totalPicks: picksSummary.totalPicksCount,
      rank: picksSummary.rank,
    })
    .from(picksSummary)
    .innerJoin(users, eq(picksSummary.userId, users.id))
    .orderBy(picksSummary.seasonType, picksSummary.weekNumber);

  // Group by week for chart data
  const weeklyData: Record<string, {
    week: string;
    seasonType: number;
    weekNumber: number;
    [key: string]: number | string;
  }> = {};

  for (const summary of summaries) {
    const weekKey = `S${summary.seasonType}W${summary.weekNumber}`;
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        week: `${summary.seasonType === 2 ? '' : summary.seasonType === 1 ? 'Pre ' : 'Post '}W${summary.weekNumber}`,
        seasonType: summary.seasonType,
        weekNumber: summary.weekNumber,
      };
    }
    weeklyData[weekKey][summary.userName ?? 'Unknown'] = summary.correctPicks ?? 0;
  }

  // Sort by season type and week number
  return Object.values(weeklyData).sort((a, b) => {
    if (a.seasonType !== b.seasonType) return a.seasonType - b.seasonType;
    return a.weekNumber - b.weekNumber;
  });
}

/**
 * Get team pick statistics (which teams are picked most/least)
 */
export async function getTeamPickStats() {
  const db = getDb();

  // Get all picks with team info
  const allPicks = await db
    .select({
      teamId: picks.teamId,
      teamName: teams.displayName,
      teamAbbr: teams.abbreviation,
      isCorrect: picks.isCorrect,
    })
    .from(picks)
    .innerJoin(teams, eq(picks.teamId, teams.id));

  // Aggregate by team
  const teamStats: Record<string, {
    teamId: string;
    teamName: string;
    teamAbbr: string;
    totalPicks: number;
    correctPicks: number;
    winRate: number;
  }> = {};

  for (const pick of allPicks) {
    if (!teamStats[pick.teamId]) {
      teamStats[pick.teamId] = {
        teamId: pick.teamId,
        teamName: pick.teamName,
        teamAbbr: pick.teamAbbr,
        totalPicks: 0,
        correctPicks: 0,
        winRate: 0,
      };
    }
    teamStats[pick.teamId].totalPicks++;
    if (pick.isCorrect === true) {
      teamStats[pick.teamId].correctPicks++;
    }
  }

  // Calculate win rates
  return Object.values(teamStats)
    .map(t => ({
      ...t,
      winRate: t.totalPicks > 0
        ? Math.round((t.correctPicks / t.totalPicks) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.totalPicks - a.totalPicks);
}

/**
 * Get head-to-head comparison between users
 */
export async function getHeadToHead(userId1: string, userId2: string) {
  const db = getDb();

  // Get weeks where both users played
  const user1Summaries = await db
    .select()
    .from(picksSummary)
    .where(eq(picksSummary.userId, userId1));

  const user2Summaries = await db
    .select()
    .from(picksSummary)
    .where(eq(picksSummary.userId, userId2));

  let user1Wins = 0;
  let user2Wins = 0;
  let ties = 0;

  for (const s1 of user1Summaries) {
    const s2 = user2Summaries.find(
      s => s.seasonType === s1.seasonType && s.weekNumber === s1.weekNumber
    );
    if (s2) {
      const s1Correct = s1.correctPicksCount ?? 0;
      const s2Correct = s2.correctPicksCount ?? 0;
      if (s1Correct > s2Correct) user1Wins++;
      else if (s2Correct > s1Correct) user2Wins++;
      else ties++;
    }
  }

  return { user1Wins, user2Wins, ties };
}

/**
 * NFL league standings (W-L-T, division/conference records, PF/PA, streak)
 * plus derived playoff seeding, grouped by conference. Computed directly
 * from this season's completed regular-season games — the `games` table
 * only ever holds one season at a time (see the season rollover), so no
 * year filter is needed.
 */
export async function getNFLStandings(): Promise<{
  standings: StandingsByDivision;
  playoffSeeds: Record<Conference, PlayoffSeed[]>;
}> {
  const db = getDb();

  const [allGames, allTeams] = await Promise.all([
    db
      .select({
        homeTeamId: games.homeTeamId,
        awayTeamId: games.awayTeamId,
        homeTeamScore: games.homeTeamScore,
        awayTeamScore: games.awayTeamScore,
        completed: games.completed,
        seasonType: games.seasonType,
        date: games.date,
      })
      .from(games),
    db
      .select({
        id: teams.id,
        abbreviation: teams.abbreviation,
        name: teams.name,
        displayName: teams.displayName,
        logo: teams.logo,
      })
      .from(teams),
  ]);

  const { rows, headToHead } = computeNFLStandings(allGames, allTeams);
  const standings = groupStandingsByDivision(rows, headToHead);
  const playoffSeeds = computePlayoffSeeding(standings, headToHead);
  return { standings, playoffSeeds };
}

export interface ChatReplySnippet {
  id: string;
  name: string;
  username: string | null;
  bodySnippet: string;
}

export interface ChatMessageWithAuthor {
  id: string;
  body: string;
  createdAt: Date | null;
  editedAt: Date | null;
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  isAdmin: boolean | null;
  replyTo: ChatReplySnippet | null;
}

const CHAT_HISTORY_LIMIT = 100;
const CHAT_REPLY_SNIPPET_LENGTH = 80;

/**
 * Most recent Locker Room messages, oldest first (ready to render top-to-
 * bottom with newest at the end) -- fetched newest-first with a LIMIT so a
 * long-running chat never means scanning the whole table, then reversed.
 * A second query resolves whatever each returned message is replying to
 * (which may be older than this page's own LIMIT) -- a plain second query
 * rather than a self-join, since Drizzle needs an aliased second `users`
 * join for that and this is simpler for a handful of distinct ids.
 */
export async function getRecentChatMessages(): Promise<ChatMessageWithAuthor[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
      replyToId: chatMessages.replyToId,
      userId: users.id,
      name: users.name,
      username: users.username,
      avatar: users.avatar,
      isAdmin: users.isAdmin,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(CHAT_HISTORY_LIMIT);

  const replyToIds = [...new Set(rows.map((r) => r.replyToId).filter((id): id is string => id !== null))];

  const replyTargets =
    replyToIds.length === 0
      ? []
      : await db
          .select({ id: chatMessages.id, body: chatMessages.body, name: users.name, username: users.username })
          .from(chatMessages)
          .innerJoin(users, eq(chatMessages.userId, users.id))
          .where(inArray(chatMessages.id, replyToIds));

  const replyTargetById = new Map(
    replyTargets.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        username: t.username,
        bodySnippet:
          t.body.length > CHAT_REPLY_SNIPPET_LENGTH
            ? `${t.body.slice(0, CHAT_REPLY_SNIPPET_LENGTH)}…`
            : t.body,
      },
    ])
  );

  return rows
    .map((r) => ({
      ...r,
      replyTo: r.replyToId ? (replyTargetById.get(r.replyToId) ?? null) : null,
    }))
    .reverse();
}

export interface ChatMentionCandidate {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
}

/** Everyone @-mentionable in the Locker Room composer's autocomplete --
 * admins only, so @mentions stay a way to get an admin's attention rather
 * than a general player-to-player notification (see notifyAdmins in
 * locker-room/actions.ts for the matching server-side restriction). Active
 * admins with a username set (one who never picked a username can't be
 * mentioned, since mentions are matched by username, not display name). */
export async function getChatMentionCandidates(): Promise<ChatMentionCandidate[]> {
  const db = getDb();

  const rows = await db
    .select({ id: users.id, username: users.username, name: users.name, avatar: users.avatar })
    .from(users)
    .where(and(isNotNull(users.username), eq(users.isActive, true), eq(users.isAdmin, true)));

  return rows.filter((r): r is ChatMentionCandidate => r.username !== null);
}
