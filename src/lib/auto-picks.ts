import { and, eq, gt, lt, lte, inArray } from "drizzle-orm";
import { db } from "../db";
import { games, picks, users, teams } from "../db/schema";
import type { UserPreferences, AutoPickStrategy } from "../db/schema";
import { generateId, favoredSide } from "./utils";
import type { AppEnv } from "./env";
import { sendAutoPickEmail } from "./email";
import { isSameEasternDay, startOfEasternDayUTC } from "./pick-reminders";

// Matches games kicking off in this window on the tick right before they'd
// otherwise lock with no pick — same cadence as the production cron that
// calls this (see worker.ts), so every eligible game gets exactly one
// chance to be auto-picked before kickoff.
const AUTO_PICK_WINDOW_MS = 15 * 60 * 1000;

export interface AutoPickedGame {
  gameId: string;
  name: string;
  shortName: string | null;
  teamAbbreviation: string;
}

export interface UpcomingAutoPickGame {
  gameId: string;
  name: string;
  shortName: string | null;
}

function resolveTeam(
  strategy: AutoPickStrategy,
  game: { homeTeamId: string; awayTeamId: string; odds: string | null },
  homeAbbr: string,
  awayAbbr: string
): string {
  const coinFlip = () => (Math.random() < 0.5 ? game.homeTeamId : game.awayTeamId);

  switch (strategy) {
    case "home":
      return game.homeTeamId;
    case "away":
      return game.awayTeamId;
    case "spread": {
      const favorite = favoredSide(game.odds, homeAbbr, awayAbbr);
      if (!favorite) return coinFlip(); // no usable line — fall back rather than fail
      return favorite === "home" ? game.homeTeamId : game.awayTeamId;
    }
    case "underdog": {
      const favorite = favoredSide(game.odds, homeAbbr, awayAbbr);
      if (!favorite) return coinFlip();
      return favorite === "home" ? game.awayTeamId : game.homeTeamId;
    }
    case "random":
    default:
      return coinFlip();
  }
}

/**
 * For every game kicking off in the next 15 minutes, auto-picks for any
 * user who has auto-pick enabled and hasn't picked that game yet. Called
 * from the same production cron tick that gates the ESPN sync and pick
 * reminders (see worker.ts) — no separate schedule needed.
 *
 * On a normal game day (early/late/primetime kickoff windows) a single
 * user's missed picks can get auto-picked across several different cron
 * ticks. To avoid spamming them with one email per window, only the first
 * auto-pick of a user's (US Eastern calendar) day sends an email — gated by
 * users.lastAutoPickEmailSentAt, same pattern as sendPickReminders. That
 * one email is a hybrid digest: it reports what was just auto-picked *and*
 * previews the rest of today's not-yet-picked games that will also get
 * auto-picked later today if the user doesn't pick them first. Any further
 * auto-picks later that same day still happen, just silently — the user
 * already got advance notice.
 */
export async function applyAutoPicks(env: AppEnv): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + AUTO_PICK_WINDOW_MS);
  const startOfDay = startOfEasternDayUTC(now);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const upcomingGames = await db
    .select({
      id: games.id,
      name: games.name,
      shortName: games.shortName,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      odds: games.odds,
      weekNumber: games.weekNumber,
      seasonType: games.seasonType,
    })
    .from(games)
    .where(and(gt(games.date, now), lte(games.date, windowEnd), eq(games.completed, false)));

  if (upcomingGames.length === 0) return;

  const gameIds = upcomingGames.map((g) => g.id);

  const [autoPickUsers, existingPicks, allTeams] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        preferences: users.preferences,
        lastAutoPickEmailSentAt: users.lastAutoPickEmailSentAt,
      })
      .from(users)
      .where(and(eq(users.emailVerified, true), eq(users.isActive, true))),
    db
      .select({ userId: picks.userId, gameId: picks.gameId })
      .from(picks)
      .where(inArray(picks.gameId, gameIds)),
    db.select({ id: teams.id, abbreviation: teams.abbreviation }).from(teams),
  ]);

  const teamAbbrById = new Map(allTeams.map((t) => [t.id, t.abbreviation]));
  const preferencesByUserId = new Map(
    autoPickUsers.map((u) => [u.id, (u.preferences ?? {}) as UserPreferences])
  );

  const existingPickKeys = new Set(existingPicks.map((p) => `${p.userId}:${p.gameId}`));

  const pickedByUser = new Map<
    string,
    { email: string; name: string; lastAutoPickEmailSentAt: Date | null; games: AutoPickedGame[] }
  >();

  for (const user of autoPickUsers) {
    const preferences = (user.preferences ?? {}) as UserPreferences;
    const autoPick = preferences.autoPick;
    if (!autoPick?.enabled) continue;

    for (const game of upcomingGames) {
      if (existingPickKeys.has(`${user.id}:${game.id}`)) continue;

      const homeAbbr = teamAbbrById.get(game.homeTeamId) ?? "";
      const awayAbbr = teamAbbrById.get(game.awayTeamId) ?? "";
      const teamId = resolveTeam(autoPick.strategy, game, homeAbbr, awayAbbr);

      try {
        await db.insert(picks).values({
          id: generateId(),
          userId: user.id,
          gameId: game.id,
          teamId,
          weekNumber: game.weekNumber,
          seasonType: game.seasonType,
          isAutoPick: true,
        });
      } catch (error) {
        // Another tick (or the user themselves) may have just inserted the
        // same pick — skip it rather than failing the rest of the batch.
        console.error(`Failed to auto-pick game ${game.id} for ${user.email}:`, error);
        continue;
      }

      const teamAbbreviation = teamId === game.homeTeamId ? homeAbbr : awayAbbr;
      const entry =
        pickedByUser.get(user.id) ??
        { email: user.email, name: user.name, lastAutoPickEmailSentAt: user.lastAutoPickEmailSentAt, games: [] };
      entry.games.push({
        gameId: game.id,
        name: game.name,
        shortName: game.shortName,
        teamAbbreviation,
      });
      pickedByUser.set(user.id, entry);
    }
  }

  if (pickedByUser.size === 0) return;

  // Only the first auto-pick email of the day goes out — see the doc
  // comment above. Users who already got one today, who've opted out of the
  // digest email specifically, or who've flipped the master email switch
  // off, are skipped here; their picks above still happened either way,
  // just silently.
  const usersToEmail = [...pickedByUser.entries()].filter(([userId, entry]) => {
    const emailPrefs = preferencesByUserId.get(userId)?.emailNotifications;
    return (
      (!entry.lastAutoPickEmailSentAt || !isSameEasternDay(entry.lastAutoPickEmailSentAt, now)) &&
      emailPrefs?.enabled !== false &&
      emailPrefs?.autoPickDigest !== false
    );
  });

  if (usersToEmail.length === 0) return;

  // Preview list: today's remaining games (after this tick's window) that
  // will get auto-picked later today unless the user picks them first.
  const laterTodayGames = await db
    .select({
      id: games.id,
      name: games.name,
      shortName: games.shortName,
      date: games.date,
    })
    .from(games)
    .where(and(gt(games.date, windowEnd), lt(games.date, endOfDay), eq(games.completed, false)))
    .orderBy(games.date);

  const previewPickKeysByUser = new Map<string, Set<string>>();
  if (laterTodayGames.length > 0) {
    const laterGameIds = laterTodayGames.map((g) => g.id);
    const laterPicks = await db
      .select({ userId: picks.userId, gameId: picks.gameId })
      .from(picks)
      .where(
        and(
          inArray(picks.gameId, laterGameIds),
          inArray(
            picks.userId,
            usersToEmail.map(([userId]) => userId)
          )
        )
      );
    for (const p of laterPicks) {
      if (!previewPickKeysByUser.has(p.userId)) previewPickKeysByUser.set(p.userId, new Set());
      previewPickKeysByUser.get(p.userId)!.add(p.gameId);
    }
  }

  for (const [userId, { email, name, games: pickedGames }] of usersToEmail) {
    const alreadyPicked = previewPickKeysByUser.get(userId);
    const upcoming: UpcomingAutoPickGame[] = laterTodayGames
      .filter((g) => !alreadyPicked?.has(g.id))
      .map((g) => ({ gameId: g.id, name: g.name, shortName: g.shortName }));

    try {
      await sendAutoPickEmail(email, name, pickedGames, upcoming, env);
      await db.update(users).set({ lastAutoPickEmailSentAt: now }).where(eq(users.id, userId));
    } catch (error) {
      // lastAutoPickEmailSentAt is only stamped on success, so a failed
      // send naturally retries on the next tick rather than being silently
      // skipped for the rest of the day.
      console.error(`Failed to send auto-pick email to ${email}:`, error);
    }
  }
}
