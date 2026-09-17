import { and, eq, gte, lt, gt, inArray } from "drizzle-orm";
import { db, type Database } from "../db";
import { games, picks, users } from "../db/schema";
import type { UserPreferences } from "../db/schema";
import type { AppEnv } from "./env";
import { sendPickReminderEmail } from "./email";
import { sendPushToUser } from "./push";

export interface MissingPickGame {
  id: string;
  name: string;
  shortName: string | null;
  date: Date;
  seasonType: number;
  weekNumber: number;
}

// NFL kickoff times, and this app's users, are effectively all US-based, so
// "today" for reminder purposes means the US Eastern calendar day rather
// than the UTC one — plain UTC day boundaries caused a real bug where, for
// anyone west of Eastern (or whenever UTC had already rolled to the next
// calendar date), a game that was still "tomorrow" locally got flagged and
// emailed as "today's game." There's no per-user timezone stored, so
// Eastern is the best available fixed reference (it's also what ESPN and
// the league itself use to talk about kickoff times).
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce(
      (acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      },
      {} as Record<string, string>
    );

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  // Round to the nearest whole minute: real timezone offsets are always a
  // whole number of minutes, but `asUTC` is built from whole-second parts
  // while `date.getTime()` keeps its milliseconds, so the raw difference
  // carries up to ~999ms of noise. That noise bled into every downstream
  // "start of day" computation, making it a moving target — since `now` at
  // each cron tick has essentially random milliseconds, `isSameEasternDay`
  // almost never matched the previously-saved send time, and pick reminders
  // went out on every single 15-minute tick instead of once a day.
  return Math.round((asUTC - date.getTime()) / 60000);
}

export function startOfEasternDayUTC(now: Date, timeZone = "America/New_York"): Date {
  const offsetMinutes = getTimezoneOffsetMinutes(now, timeZone);
  const localAsUTC = new Date(now.getTime() + offsetMinutes * 60000);
  const localMidnightAsUTC = Date.UTC(
    localAsUTC.getUTCFullYear(),
    localAsUTC.getUTCMonth(),
    localAsUTC.getUTCDate()
  );
  return new Date(localMidnightAsUTC - offsetMinutes * 60000);
}

interface UserWithMissingPicks {
  userId: string;
  email: string;
  name: string;
  preferences: UserPreferences | null;
  games: MissingPickGame[];
}

/**
 * Games kicking off later today (US Eastern calendar day) that are still
 * pickable, grouped by every verified, active user who hasn't picked them
 * yet -- regardless of notification preferences, which each channel
 * (email/push) filters for itself below, since a user can have one channel
 * enabled and not the other.
 */
export async function getUsersWithMissingPicksToday(db: Database): Promise<UserWithMissingPicks[]> {
  const now = new Date();
  const startOfDay = startOfEasternDayUTC(now);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const todaysGames = await db
    .select({
      id: games.id,
      name: games.name,
      shortName: games.shortName,
      date: games.date,
      seasonType: games.seasonType,
      weekNumber: games.weekNumber,
    })
    .from(games)
    .where(
      and(
        gte(games.date, startOfDay),
        lt(games.date, endOfDay),
        gt(games.date, now),
        eq(games.completed, false)
      )
    )
    .orderBy(games.date);

  if (todaysGames.length === 0) return [];

  const gameIds = todaysGames.map((g) => g.id);

  const [eligibleUsers, existingPicks] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, name: users.name, preferences: users.preferences })
      .from(users)
      .where(and(eq(users.emailVerified, true), eq(users.isActive, true))),
    db
      .select({ userId: picks.userId, gameId: picks.gameId })
      .from(picks)
      .where(inArray(picks.gameId, gameIds)),
  ]);

  const pickedGameIdsByUser = new Map<string, Set<string>>();
  for (const pick of existingPicks) {
    if (!pickedGameIdsByUser.has(pick.userId)) {
      pickedGameIdsByUser.set(pick.userId, new Set());
    }
    pickedGameIdsByUser.get(pick.userId)!.add(pick.gameId);
  }

  const result: UserWithMissingPicks[] = [];
  for (const user of eligibleUsers) {
    const picked = pickedGameIdsByUser.get(user.id);
    const missing = todaysGames.filter((g) => !picked?.has(g.id));
    if (missing.length > 0) {
      result.push({
        userId: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences as UserPreferences | null,
        games: missing,
      });
    }
  }

  return result;
}

export function isSameEasternDay(a: Date, b: Date): boolean {
  return startOfEasternDayUTC(a).getTime() === startOfEasternDayUTC(b).getTime();
}

/**
 * Sends one reminder email per user with missing picks for a game later
 * today, at most once per user per (US Eastern) day — gated by
 * users.lastPickReminderSentAt rather than by a fixed send time, so this
 * can just run on the same 15-minute production cron that already gates
 * the ESPN sync (see worker.ts) without any extra scheduling.
 */
export async function sendPickReminders(env: AppEnv): Promise<void> {
  const now = new Date();

  const usersWithMissingPicks = await getUsersWithMissingPicksToday(db);
  if (usersWithMissingPicks.length === 0) return;

  // Opt-out, not opt-in: absent/undefined means the reminder still goes
  // out, matching behavior from before this preference existed. The master
  // `enabled` switch overrides the individual toggle when off.
  const emailEligible = usersWithMissingPicks.filter((u) => {
    const emailPrefs = u.preferences?.emailNotifications;
    return emailPrefs?.enabled !== false && emailPrefs?.pickReminders !== false;
  });
  if (emailEligible.length === 0) return;

  const alreadySentToday = new Set(
    (
      await db
        .select({ id: users.id, lastPickReminderSentAt: users.lastPickReminderSentAt })
        .from(users)
        .where(
          inArray(
            users.id,
            emailEligible.map((u) => u.userId)
          )
        )
    )
      .filter((u) => u.lastPickReminderSentAt && isSameEasternDay(u.lastPickReminderSentAt, now))
      .map((u) => u.id)
  );

  for (const user of emailEligible) {
    if (alreadySentToday.has(user.userId)) continue;

    try {
      await sendPickReminderEmail(user.email, user.name, user.games, env);
      await db
        .update(users)
        .set({ lastPickReminderSentAt: now })
        .where(eq(users.id, user.userId));
    } catch (error) {
      // Don't let one failed send (or a stale email address) block the
      // rest of the batch. lastPickReminderSentAt is only stamped on
      // success, so a failure here naturally retries on the next tick
      // rather than being silently skipped for the rest of the day.
      console.error(`Failed to send pick reminder to ${user.email}:`, error);
    }
  }
}

/**
 * Push equivalent of sendPickReminders above -- same once-per-day cadence,
 * gated by its own lastPickReminderPushSentAt column so a user with both
 * channels enabled gets one email AND one push per day, not whichever
 * channel's branch happens to run first on the shared cron tick.
 */
export async function sendPickRemindersPush(env: AppEnv): Promise<void> {
  const now = new Date();

  const usersWithMissingPicks = await getUsersWithMissingPicksToday(db);
  if (usersWithMissingPicks.length === 0) return;

  const pushEligible = usersWithMissingPicks.filter((u) => {
    const pushPrefs = u.preferences?.pushNotifications;
    return pushPrefs?.enabled !== false && pushPrefs?.missingPicks !== false;
  });
  if (pushEligible.length === 0) return;

  const alreadySentToday = new Set(
    (
      await db
        .select({ id: users.id, lastPickReminderPushSentAt: users.lastPickReminderPushSentAt })
        .from(users)
        .where(
          inArray(
            users.id,
            pushEligible.map((u) => u.userId)
          )
        )
    )
      .filter((u) => u.lastPickReminderPushSentAt && isSameEasternDay(u.lastPickReminderPushSentAt, now))
      .map((u) => u.id)
  );

  for (const user of pushEligible) {
    if (alreadySentToday.has(user.userId)) continue;

    try {
      const gameWord = user.games.length === 1 ? "game" : "games";
      await sendPushToUser(db, env, user.userId, {
        title: "Missing picks",
        body: `You have ${user.games.length} ${gameWord} left to pick today.`,
        url: `/picks/${user.games[0].seasonType}/${user.games[0].weekNumber}`,
      });
      await db
        .update(users)
        .set({ lastPickReminderPushSentAt: now })
        .where(eq(users.id, user.userId));
    } catch (error) {
      console.error(`Failed to send pick reminder push to user ${user.userId}:`, error);
    }
  }
}
