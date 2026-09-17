// Relative imports throughout, not the "@/" tsconfig alias -- this runs
// from src/cron/index.ts, which tsx executes directly rather than through
// Next's bundler (see CLAUDE.md's "Path aliases" note). Deliberately
// avoids importing anything from data.ts or email-merge-vars.ts too: both
// are fine under Next's own request handling but aren't part of the
// tsx-run set of files. pick-reminders.ts and auto-picks.ts follow the
// same rule for the same reason -- see their own top-of-file comments.
import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { games, picksSummary, siteSettings, users, weekResultsEmails, weekResultsPushes } from "../db/schema";
import type { UserPreferences } from "../db/schema";
import type { AppEnv } from "./env";
import { sendAdminBroadcastEmail, formatKickoff } from "./email";
import { sendPushToUser } from "./push";
import { getWeekResultsSummary } from "./week-results";
import { getSeasonTypeName } from "./utils";
import { SITE_URL } from "./site-config";

// site_settings only ever has this one row (see SITE_SETTINGS_ID in
// data.ts, which this file can't import -- see the module comment above).
const SITE_SETTINGS_ID = "singleton";

/** Replaces {tokenName} with its value; an unrecognized token (a typo, or
 * literal curly braces the admin actually meant) is left as-is rather than
 * blanked out. Deliberately its own tiny copy rather than importing
 * applyMergeVariables from email-merge-vars.ts -- see the module comment. */
function applyTemplateVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? vars[name] : match));
}

async function getNextUpcomingGame() {
  const [game] = await db
    .select({
      id: games.id,
      name: games.name,
      shortName: games.shortName,
      date: games.date,
      seasonType: games.seasonType,
      weekNumber: games.weekNumber,
    })
    .from(games)
    .where(and(eq(games.completed, false), gt(games.date, new Date())))
    .orderBy(asc(games.date))
    .limit(1);
  return game ?? null;
}

/**
 * Finds every (seasonType, weekNumber) whose picks_summary.rank was just
 * finalized -- updateWeeklyStandings (game-sync-core.ts) only assigns rank
 * once every game that week has completed -- but hasn't had its results
 * email sent yet, and sends one using the admin-editable site_settings
 * template. Runs on the same 15-minute cron tick as the ESPN sync gate,
 * auto-picks, and pick reminders (see src/cron/index.ts); no separate
 * schedule needed since this is just as cheap a database read as those.
 */
export async function sendWeekResultsEmails(env: AppEnv): Promise<void> {
  const [templateRows, candidateWeeks, alreadySentRows] = await Promise.all([
    db
      .select({ subject: siteSettings.weekResultsEmailSubject, body: siteSettings.weekResultsEmailBody })
      .from(siteSettings)
      .where(eq(siteSettings.id, SITE_SETTINGS_ID))
      .limit(1),
    db
      .selectDistinct({ seasonType: picksSummary.seasonType, weekNumber: picksSummary.weekNumber })
      .from(picksSummary)
      .where(isNotNull(picksSummary.rank)),
    db
      .select({ seasonType: weekResultsEmails.seasonType, weekNumber: weekResultsEmails.weekNumber })
      .from(weekResultsEmails),
  ]);

  const subjectTemplate = templateRows[0]?.subject;
  const bodyTemplate = templateRows[0]?.body;
  // Nothing configured yet (see the admin dashboard's Week Results Email
  // section) -- don't send anything rather than mailing out a blank recap.
  if (!subjectTemplate || !bodyTemplate) return;

  const alreadySent = new Set(alreadySentRows.map((w) => `${w.seasonType}-${w.weekNumber}`));
  const pendingWeeks = candidateWeeks.filter((w) => !alreadySent.has(`${w.seasonType}-${w.weekNumber}`));
  if (pendingWeeks.length === 0) return;

  const nextGame = await getNextUpcomingGame();
  const sharedVars: Record<string, string> = {
    next_game: nextGame ? nextGame.shortName || nextGame.name : "your next game",
    next_game_start_time: nextGame ? formatKickoff(nextGame.date) : "TBD",
    next_game_week: nextGame ? `${getSeasonTypeName(nextGame.seasonType)} Week ${nextGame.weekNumber}` : "TBD",
    picks_url: nextGame ? `${SITE_URL}/picks/${nextGame.seasonType}/${nextGame.weekNumber}` : SITE_URL,
    site_url: SITE_URL,
  };

  const recipients = await db
    .select({ id: users.id, email: users.email, name: users.name, preferences: users.preferences })
    .from(users)
    .where(and(eq(users.emailVerified, true), eq(users.isActive, true)));

  // Opt-out, not opt-in, matching every other automated email here.
  const eligibleRecipients = recipients.filter((u) => {
    const emailPrefs = (u.preferences as UserPreferences | null)?.emailNotifications;
    return emailPrefs?.enabled !== false && emailPrefs?.weekResults !== false;
  });

  for (const week of pendingWeeks) {
    try {
      await sendForWeek(env, week.seasonType, week.weekNumber, subjectTemplate, bodyTemplate, sharedVars, eligibleRecipients);
      // Marked sent even if some individual sends below failed -- matches
      // sendAdminBroadcast's per-recipient try/catch: a bad address
      // shouldn't hold the whole pool's results back on every future tick.
      await db.insert(weekResultsEmails).values({
        id: crypto.randomUUID(),
        seasonType: week.seasonType,
        weekNumber: week.weekNumber,
        sentAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to send week results email for season ${week.seasonType} week ${week.weekNumber}:`, error);
    }
  }
}

async function sendForWeek(
  env: AppEnv,
  seasonType: number,
  weekNumber: number,
  subjectTemplate: string,
  bodyTemplate: string,
  sharedVars: Record<string, string>,
  recipients: { id: string; email: string; name: string }[]
): Promise<void> {
  const weekResults = await getWeekResultsSummary(db, seasonType, weekNumber);
  // Shouldn't happen -- rank was non-null a moment ago in the caller's own
  // query -- but don't mail out a template full of unresolved {tokens} if
  // it somehow does.
  if (!weekResults || recipients.length === 0) return;

  const vars: Record<string, string> = {
    ...sharedVars,
    week_results_week: weekResults.week,
    week_results_first_place: weekResults.firstPlace,
    week_results_second_place: weekResults.secondPlace,
    week_results_third_place: weekResults.thirdPlace,
    week_results_tiebreaker_winners: weekResults.tiebreakerWinners,
  };

  for (const recipient of recipients) {
    try {
      const recipientVars = { ...vars, name: recipient.name };
      const subject = applyTemplateVariables(subjectTemplate, recipientVars);
      const body = applyTemplateVariables(bodyTemplate, recipientVars);
      await sendAdminBroadcastEmail(recipient.email, recipient.name, subject, body, env);
    } catch (error) {
      console.error(`Failed to send week results email to ${recipient.email}:`, error);
    }
  }
}

// weekResults.firstPlace/etc. carry a trailing " (+2)"/"(+1 each)" point
// annotation meant for the email template's table-like layout -- too much
// clutter for a one-line push body, so this strips it back to a plain name.
function stripPointSuffix(label: string): string {
  return label.replace(/\s*\(\+\d+(?: each)?\)$/, "");
}

async function sendPushForWeek(
  env: AppEnv,
  seasonType: number,
  weekNumber: number,
  recipients: { id: string }[]
): Promise<void> {
  const weekResults = await getWeekResultsSummary(db, seasonType, weekNumber);
  if (!weekResults || recipients.length === 0) return;

  const firstPlaceName = weekResults.firstPlace ? stripPointSuffix(weekResults.firstPlace) : "";
  const body = firstPlaceName
    ? `${firstPlaceName} took 1st place. Tap to see the full standings.`
    : "Tap to see the full standings.";

  for (const recipient of recipients) {
    try {
      await sendPushToUser(db, env, recipient.id, {
        title: `${weekResults.week} Results`,
        body,
        url: "/",
      });
    } catch (error) {
      console.error(`Failed to send week results push to user ${recipient.id}:`, error);
    }
  }
}

/**
 * Push equivalent of sendWeekResultsEmails above -- same "newly-ranked week"
 * detection, but its own weekResultsPushes tracking table (see schema.ts)
 * so the two channels' once-per-week gates don't fight over the same row.
 * Unlike the email, which is personalized per recipient via {name} and the
 * admin-edited template, every push for a given week carries the same
 * announcement -- there's no per-user push template to fill in.
 */
export async function sendWeekResultsPush(env: AppEnv): Promise<void> {
  const [candidateWeeks, alreadySentRows] = await Promise.all([
    db
      .selectDistinct({ seasonType: picksSummary.seasonType, weekNumber: picksSummary.weekNumber })
      .from(picksSummary)
      .where(isNotNull(picksSummary.rank)),
    db
      .select({ seasonType: weekResultsPushes.seasonType, weekNumber: weekResultsPushes.weekNumber })
      .from(weekResultsPushes),
  ]);

  const alreadySent = new Set(alreadySentRows.map((w) => `${w.seasonType}-${w.weekNumber}`));
  const pendingWeeks = candidateWeeks.filter((w) => !alreadySent.has(`${w.seasonType}-${w.weekNumber}`));
  if (pendingWeeks.length === 0) return;

  const recipients = await db
    .select({ id: users.id, preferences: users.preferences })
    .from(users)
    .where(and(eq(users.emailVerified, true), eq(users.isActive, true)));

  // Opt-out, not opt-in, matching every other push/email preference here.
  const pushEligible = recipients.filter((u) => {
    const pushPrefs = (u.preferences as UserPreferences | null)?.pushNotifications;
    return pushPrefs?.enabled !== false && pushPrefs?.weekResults !== false;
  });

  for (const week of pendingWeeks) {
    try {
      await sendPushForWeek(env, week.seasonType, week.weekNumber, pushEligible);
      // Marked sent even if nobody was push-eligible or some individual
      // sends above failed -- matches sendWeekResultsEmails, so a bad
      // subscription can't hold this week's tracking row back forever.
      await db.insert(weekResultsPushes).values({
        id: crypto.randomUUID(),
        seasonType: week.seasonType,
        weekNumber: week.weekNumber,
        sentAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to send week results push for season ${week.seasonType} week ${week.weekNumber}:`, error);
    }
  }
}
