// Core game-sync logic: takes already-fetched ESPN event data and writes it to the DB.
// Split out from the ESPN fetch itself so this can be driven by data fetched
// from wherever the sync relay runs -- see CLAUDE.md's note on the GitHub
// Actions relay this app is built to work with.

import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Database } from "../db";
import { generateId } from "./utils";

export interface SyncWeekResult {
  updated: number;
  inserted: number;
  skipped: number;
  skipReason: { alreadyComplete: number; noChange: number; teamsNotSet: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ESPNEventPayload = any;

// ESPN uses these abbreviations for placeholder/pseudo teams (undetermined
// playoff berths, conference-level entries) rather than real roster teams.
const PLACEHOLDER_TEAM_ABBREVIATIONS = new Set(["TBD", "AFC", "NFC"]);

// SQLite rejects a single query with too many bound parameters ("too many
// SQL variables") -- the default compiled-in limit is much higher than this,
// but staying well under it keeps a `DELETE ... WHERE id IN (...)` safe
// regardless of how it's compiled, once a season's worth of rows (300+) is
// involved.
const SQLITE_MAX_BOUND_PARAMS = 90;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function hasGameChanged(
  existing: typeof schema.games.$inferSelect,
  newData: {
    homeTeamScore: number | null;
    awayTeamScore: number | null;
    completed: boolean;
    statusName: string;
    date: Date;
    odds: string | null;
    overUnder: number | null;
  }
): boolean {
  if (existing.homeTeamScore !== newData.homeTeamScore) return true;
  if (existing.awayTeamScore !== newData.awayTeamScore) return true;
  if (existing.completed !== newData.completed) return true;
  if (existing.statusName !== newData.statusName) return true;
  if (existing.odds !== newData.odds) return true;
  if (existing.overUnder !== newData.overUnder) return true;
  const existingTime = existing.date.getTime();
  const newTime = newData.date.getTime();
  if (Math.abs(existingTime - newTime) > 60000) return true;
  return false;
}

export async function calculatePickResults(
  db: Database,
  gameId: string,
  game: { homeTeamId: string; awayTeamId: string; homeTeamScore: number | null; awayTeamScore: number | null }
): Promise<void> {
  let winningTeamId: string | null = null;
  if (game.homeTeamScore !== null && game.awayTeamScore !== null) {
    if (game.homeTeamScore > game.awayTeamScore) {
      winningTeamId = game.homeTeamId;
    } else if (game.awayTeamScore > game.homeTeamScore) {
      winningTeamId = game.awayTeamId;
    }
  }

  const gamePicks = await db.select().from(schema.picks).where(eq(schema.picks.gameId, gameId));

  for (const pick of gamePicks) {
    const isCorrect = winningTeamId ? pick.teamId === winningTeamId : null;
    await db
      .update(schema.picks)
      .set({ isCorrect, updatedAt: new Date() })
      .where(eq(schema.picks.id, pick.id));
  }

  console.log(`Calculated results for ${gamePicks.length} picks on game ${gameId}`);
}

export async function calculateTiebreakerResults(
  db: Database,
  gameId: string,
  actualTotal: number,
  seasonType: number,
  weekNumber: number
): Promise<void> {
  const summaries = await db
    .select()
    .from(schema.picksSummary)
    .where(
      and(
        eq(schema.picksSummary.seasonType, seasonType),
        eq(schema.picksSummary.weekNumber, weekNumber),
        eq(schema.picksSummary.tiebreakerGameId, gameId)
      )
    );

  for (const summary of summaries) {
    const diff =
      summary.tiebreakerPrediction !== null
        ? Math.abs(summary.tiebreakerPrediction - actualTotal)
        : null;

    await db
      .update(schema.picksSummary)
      .set({
        tiebreakerActual: actualTotal,
        tiebreakerDiff: diff,
        updatedAt: new Date(),
      })
      .where(eq(schema.picksSummary.id, summary.id));
  }

  console.log(`Updated tiebreaker results for ${summaries.length} summaries`);
}

export async function updateWeeklyStandings(
  db: Database,
  seasonType: number,
  weekNumber: number
): Promise<void> {
  const userPicks = await db
    .select({
      userId: schema.picks.userId,
      correctCount: sql<number>`COUNT(CASE WHEN ${schema.picks.isCorrect} = 1 THEN 1 END)`,
      totalCount: sql<number>`COUNT(*)`,
    })
    .from(schema.picks)
    .where(and(eq(schema.picks.seasonType, seasonType), eq(schema.picks.weekNumber, weekNumber)))
    .groupBy(schema.picks.userId);

  for (const userPick of userPicks) {
    const existingSummary = await db
      .select()
      .from(schema.picksSummary)
      .where(
        and(
          eq(schema.picksSummary.userId, userPick.userId),
          eq(schema.picksSummary.seasonType, seasonType),
          eq(schema.picksSummary.weekNumber, weekNumber)
        )
      )
      .limit(1);

    if (existingSummary.length > 0) {
      await db
        .update(schema.picksSummary)
        .set({
          correctPicksCount: userPick.correctCount,
          totalPicksCount: userPick.totalCount,
          updatedAt: new Date(),
        })
        .where(eq(schema.picksSummary.id, existingSummary[0].id));
    } else {
      await db.insert(schema.picksSummary).values({
        id: crypto.randomUUID(),
        userId: userPick.userId,
        seasonType,
        weekNumber,
        correctPicksCount: userPick.correctCount,
        totalPicksCount: userPick.totalCount,
      });
    }
  }

  // This runs every time a single game in the week completes, not just once
  // the whole week is decided -- correctPicksCount/totalPicksCount above are
  // fine to keep live (they're just this-user-so-far counts), but `rank`
  // feeds the weekly-1st/2nd overall-standings bonus (getOverallStandings in
  // data.ts), so assigning it off a week that's only partially graded lets
  // whoever happens to be ahead after the first game or two "win" the week
  // before most players have even had a game decided. Only rank once every
  // game scheduled for this week has completed; otherwise clear any rank a
  // previous (partial) call already assigned, so a leftover 1st/2nd from
  // earlier in the week doesn't keep paying out a bonus it didn't earn.
  const [{ incomplete }] = await db
    .select({ incomplete: sql<number>`COUNT(*)` })
    .from(schema.games)
    .where(
      and(
        eq(schema.games.seasonType, seasonType),
        eq(schema.games.weekNumber, weekNumber),
        eq(schema.games.completed, false)
      )
    );

  if (incomplete > 0) {
    await db
      .update(schema.picksSummary)
      .set({ rank: null, updatedAt: new Date() })
      .where(and(eq(schema.picksSummary.seasonType, seasonType), eq(schema.picksSummary.weekNumber, weekNumber)));

    console.log(`Week ${weekNumber} not fully complete (${incomplete} game(s) remaining) -- rank not yet assigned`);
    return;
  }

  const rankedSummaries = await db
    .select()
    .from(schema.picksSummary)
    .where(and(eq(schema.picksSummary.seasonType, seasonType), eq(schema.picksSummary.weekNumber, weekNumber)))
    .orderBy(
      desc(schema.picksSummary.correctPicksCount),
      asc(schema.picksSummary.tiebreakerDiff),
      // Two different predictions can land the same distance from the
      // actual total — break that tie in favor of whoever predicted first.
      // A user who never submitted a tiebreaker guess has a NULL
      // tiebreakerSubmittedAt -- SQLite's default ASC ordering sorts NULLs
      // first, which would let "never guessed" win this tiebreak over
      // someone who actually predicted early. Push NULLs to the back.
      sql`${schema.picksSummary.tiebreakerSubmittedAt} IS NULL`,
      asc(schema.picksSummary.tiebreakerSubmittedAt)
    );

  for (let i = 0; i < rankedSummaries.length; i++) {
    await db
      .update(schema.picksSummary)
      .set({ rank: i + 1, updatedAt: new Date() })
      .where(eq(schema.picksSummary.id, rankedSummaries[i].id));
  }

  console.log(`Updated standings for ${rankedSummaries.length} users in week ${weekNumber}`);
}

/**
 * Keeps one user's picks_summary row (or its total/correct counts) current
 * the moment they make or change a pick, rather than waiting on the next
 * game to complete -- updateWeeklyStandings above only recomputes counts as
 * a side effect of a game finishing, so a user who picks after the week's
 * most recent completion (or before its first one) previously had a stale
 * or entirely missing picks_summary row until another game finished. Never
 * touches rank -- that's still only assigned once the whole week is graded.
 */
export async function syncPicksSummaryCountForUser(
  db: Database,
  userId: string,
  seasonType: number,
  weekNumber: number
): Promise<void> {
  const [counts] = await db
    .select({
      correctCount: sql<number>`COUNT(CASE WHEN ${schema.picks.isCorrect} = 1 THEN 1 END)`,
      totalCount: sql<number>`COUNT(*)`,
    })
    .from(schema.picks)
    .where(
      and(
        eq(schema.picks.userId, userId),
        eq(schema.picks.seasonType, seasonType),
        eq(schema.picks.weekNumber, weekNumber)
      )
    );

  const existingSummary = await db
    .select()
    .from(schema.picksSummary)
    .where(
      and(
        eq(schema.picksSummary.userId, userId),
        eq(schema.picksSummary.seasonType, seasonType),
        eq(schema.picksSummary.weekNumber, weekNumber)
      )
    )
    .limit(1);

  if (existingSummary.length > 0) {
    await db
      .update(schema.picksSummary)
      .set({
        correctPicksCount: counts.correctCount,
        totalPicksCount: counts.totalCount,
        updatedAt: new Date(),
      })
      .where(eq(schema.picksSummary.id, existingSummary[0].id));
  } else {
    await db.insert(schema.picksSummary).values({
      id: crypto.randomUUID(),
      userId,
      seasonType,
      weekNumber,
      correctPicksCount: counts.correctCount,
      totalPicksCount: counts.totalCount,
    });
  }
}

/**
 * Upsert a week's games from already-fetched ESPN event payloads, grading picks
 * and updating standings/tiebreakers whenever a game transitions to completed.
 */
export async function syncEventsForWeek(
  db: Database,
  seasonType: number,
  week: number,
  events: ESPNEventPayload[]
): Promise<SyncWeekResult> {
  let updated = 0,
    inserted = 0,
    skipped = 0;
  const skipReason = { alreadyComplete: 0, noChange: 0, teamsNotSet: 0 };

  for (const event of events) {
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find((c: ESPNEventPayload) => c.homeAway === "home");
    const awayTeam = competition.competitors.find((c: ESPNEventPayload) => c.homeAway === "away");
    const odds = competition.odds?.[0];

    const gameDate = new Date(event.date);
    const gameData = {
      id: event.id,
      name: event.name,
      shortName: event.shortName ?? null,
      date: gameDate,
      seasonType,
      weekNumber: week,
      homeTeamId: homeTeam?.team?.id ?? "",
      awayTeamId: awayTeam?.team?.id ?? "",
      homeTeamScore: homeTeam?.score ? parseInt(homeTeam.score) : null,
      awayTeamScore: awayTeam?.score ? parseInt(awayTeam.score) : null,
      completed: event.status?.type?.completed ?? false,
      statusName: event.status?.type?.name ?? "STATUS_SCHEDULED",
      odds: odds?.details ?? null,
      overUnder: odds?.overUnder ?? null,
    };

    // Postseason games are often published as placeholders before playoff
    // seeding is determined by regular-season standings. ESPN sometimes
    // omits the team object entirely, and sometimes fills it with a
    // reserved "TBD"/"AFC"/"NFC" placeholder (a real, non-empty id) rather
    // than a real roster team. games.homeTeamId/awayTeamId are FK-constrained
    // against teams, so skip rather than insert/overwrite with an
    // unresolved matchup either way.
    const homeAbbr = homeTeam?.team?.abbreviation;
    const awayAbbr = awayTeam?.team?.abbreviation;
    if (
      !gameData.homeTeamId ||
      !gameData.awayTeamId ||
      PLACEHOLDER_TEAM_ABBREVIATIONS.has(homeAbbr) ||
      PLACEHOLDER_TEAM_ABBREVIATIONS.has(awayAbbr)
    ) {
      skipped++;
      skipReason.teamsNotSet++;
      continue;
    }

    const existing = await db.select().from(schema.games).where(eq(schema.games.id, event.id)).limit(1);
    const existingGame = existing[0];
    const wasCompleted = existingGame?.completed ?? false;

    if (existingGame) {
      if (wasCompleted && gameData.completed) {
        skipped++;
        skipReason.alreadyComplete++;
        continue;
      }

      if (hasGameChanged(existingGame, gameData)) {
        await db
          .update(schema.games)
          .set({ ...gameData, updatedAt: new Date() })
          .where(eq(schema.games.id, event.id));
        updated++;
      } else {
        skipped++;
        skipReason.noChange++;
      }
    } else {
      await db.insert(schema.games).values({
        ...gameData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      inserted++;
    }

    if (gameData.completed && !wasCompleted) {
      await calculatePickResults(db, event.id, gameData);

      if (gameData.homeTeamScore !== null && gameData.awayTeamScore !== null) {
        const actualTotal = gameData.homeTeamScore + gameData.awayTeamScore;
        await calculateTiebreakerResults(db, event.id, actualTotal, seasonType, week);
      }

      await updateWeeklyStandings(db, seasonType, week);
    }
  }

  return { updated, inserted, skipped, skipReason };
}

export function getMaxWeeksForSeasonType(seasonType: number): number {
  switch (seasonType) {
    case 1:
      return 4;
    case 2:
      return 18;
    case 3:
      return 5;
    default:
      return 18;
  }
}

/**
 * The NFL season a date belongs to, per how the league names seasons:
 * a January/February date belongs to the season that started the previous
 * calendar year (e.g. the Super Bowl played in Feb 2026 is "the 2025 season").
 */
export function computeSeasonYear(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  return month <= 6 ? year - 1 : year;
}

export interface RolloverResult {
  archivedGames: number;
  archivedPicks: number;
  archivedSummaries: number;
  newGamesInserted: number;
  newGamesUpdated: number;
}

/**
 * Archives every game (and its picks/standings) belonging to a season before
 * `newSeasonYear`, leaving any current/future-season data untouched, then
 * loads the new season's full schedule from pre-fetched ESPN event data.
 */
export async function rolloverSeason(
  db: Database,
  newSeasonYear: number,
  newSeasonWeeks: { seasonType: number; week: number; events: ESPNEventPayload[] }[]
): Promise<RolloverResult> {
  const now = new Date();

  // 1. Classify existing games by the season they actually belong to.
  const allGames = await db.select().from(schema.games);
  const oldGames = allGames.filter((g) => computeSeasonYear(g.date) < newSeasonYear);
  const oldGameIds = oldGames.map((g) => g.id);

  // 2. Archive old games, then delete them. Archiving is idempotent — if a
  //    previous run archived a game but crashed before deleting it (e.g. the
  //    delete itself exceeded SQLite's bound-parameter limit), a retry must not
  //    insert a second archived_games row for the same original game.
  const alreadyArchivedIds = new Set(
    (await db.select({ originalId: schema.archivedGames.originalId }).from(schema.archivedGames)).map(
      (r) => r.originalId
    )
  );
  for (const game of oldGames) {
    if (alreadyArchivedIds.has(game.id)) continue;
    await db.insert(schema.archivedGames).values({
      id: generateId(),
      originalId: game.id,
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
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      seasonYear: computeSeasonYear(game.date),
      archivedAt: now,
    });
  }
  for (const idBatch of chunk(oldGameIds, SQLITE_MAX_BOUND_PARAMS)) {
    await db.delete(schema.games).where(inArray(schema.games.id, idBatch));
  }

  // 3. Archive and delete picks tied to those old games; current-season picks
  //    (tied to games we didn't touch, or with no matching game yet) are left alone.
  const oldGameIdSet = new Set(oldGameIds);
  const allPicks = await db.select().from(schema.picks);
  const oldPicks = allPicks.filter((p) => oldGameIdSet.has(p.gameId));

  const alreadyArchivedPickIds = new Set(
    (await db.select({ originalId: schema.archivedPicks.originalId }).from(schema.archivedPicks)).map(
      (r) => r.originalId
    )
  );
  for (const pick of oldPicks) {
    if (alreadyArchivedPickIds.has(pick.id)) continue;
    await db.insert(schema.archivedPicks).values({
      id: generateId(),
      originalId: pick.id,
      userId: pick.userId,
      gameId: pick.gameId,
      teamId: pick.teamId,
      weekNumber: pick.weekNumber,
      seasonType: pick.seasonType,
      isCorrect: pick.isCorrect,
      createdAt: pick.createdAt,
      updatedAt: pick.updatedAt,
      seasonYear: newSeasonYear - 1,
      archivedAt: now,
    });
  }
  const oldPickIds = oldPicks.map((p) => p.id);
  for (const idBatch of chunk(oldPickIds, SQLITE_MAX_BOUND_PARAMS)) {
    await db.delete(schema.picks).where(inArray(schema.picks.id, idBatch));
  }

  // 4. Standings have no direct link back to a game or a year, so classify by
  //    whether any surviving (current-season) pick still uses that week/type.
  const remainingPicks = await db.select().from(schema.picks);
  const currentCombos = new Set(remainingPicks.map((p) => `${p.seasonType}-${p.weekNumber}`));

  const allSummaries = await db.select().from(schema.picksSummary);
  const oldSummaries = allSummaries.filter(
    (s) => !currentCombos.has(`${s.seasonType}-${s.weekNumber}`)
  );

  for (const summary of oldSummaries) {
    await db.insert(schema.archivedPicksSummary).values({
      id: generateId(),
      originalId: summary.id,
      userId: summary.userId,
      weekNumber: summary.weekNumber,
      seasonType: summary.seasonType,
      tiebreakerGameId: summary.tiebreakerGameId,
      tiebreakerPrediction: summary.tiebreakerPrediction,
      tiebreakerSubmittedAt: summary.tiebreakerSubmittedAt,
      correctPicksCount: summary.correctPicksCount,
      totalPicksCount: summary.totalPicksCount,
      tiebreakerActual: summary.tiebreakerActual,
      tiebreakerDiff: summary.tiebreakerDiff,
      rank: summary.rank,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      seasonYear: newSeasonYear - 1,
      archivedAt: now,
    });
  }

  // Clear every summary row and rebuild the current-season ones fresh from
  // the picks that survived, so nothing stale lingers under a reused
  // (seasonType, week) key.
  await db.delete(schema.picksSummary);
  for (const combo of currentCombos) {
    const [seasonType, week] = combo.split("-").map(Number);
    await updateWeeklyStandings(db, seasonType, week);
  }

  // 5. Load the new season's full schedule (idempotent upsert, so this is
  //    safe to run even if some current-season games were already synced).
  let newGamesInserted = 0;
  let newGamesUpdated = 0;
  for (const week of newSeasonWeeks) {
    const result = await syncEventsForWeek(db, week.seasonType, week.week, week.events);
    newGamesInserted += result.inserted;
    newGamesUpdated += result.updated;
  }

  return {
    archivedGames: oldGames.length,
    archivedPicks: oldPicks.length,
    archivedSummaries: oldSummaries.length,
    newGamesInserted,
    newGamesUpdated,
  };
}
