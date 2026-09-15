// Replaces the Cloudflare Worker cron trigger this app was ported from (see
// worker.ts's `scheduled` handler in the original). Runs every 15 minutes in
// this same long-lived process instead of as a separate Workers invocation --
// there's no separate scheduler to wire up in a single-container deployment.
import cron from "node-cron";
import { and, eq, lte, count } from "drizzle-orm";
import { db } from "../db";
import { games } from "../db/schema";
import { getEnv } from "../lib/env";
import { runEspnSync } from "../lib/sync-runner";
import { applyAutoPicks } from "../lib/auto-picks";
import { sendPickReminders } from "../lib/pick-reminders";
import { sendWeekResultsEmails } from "../lib/week-results-email";

// Skips the ESPN fetch on ticks where nothing's in progress -- not because
// of any Cloudflare-style egress block or per-invocation billing (neither
// applies to a self-hosted container), just to avoid hammering ESPN's
// undocumented API every 15 minutes, 24/7, all year, when nothing's
// happening. Checking our own `completed` flag rather than ESPN's live
// status means this can't miss the poll where a game finishes, since
// `completed` only flips once that final score has actually been synced.
async function hasGameInProgress(): Promise<boolean> {
  const result = await db
    .select({ count: count() })
    .from(games)
    .where(and(eq(games.completed, false), lte(games.date, new Date())));
  return (result[0]?.count ?? 0) > 0;
}

async function tick(): Promise<void> {
  try {
    if (await hasGameInProgress()) {
      await runEspnSync(db);
    }
  } catch (error) {
    console.error("Scheduled ESPN sync failed:", error);
  }

  const env = getEnv();

  try {
    await applyAutoPicks(env);
  } catch (error) {
    console.error("Scheduled auto-pick check failed:", error);
  }

  try {
    await sendPickReminders(env);
  } catch (error) {
    console.error("Scheduled pick reminder check failed:", error);
  }

  try {
    await sendWeekResultsEmails(env);
  } catch (error) {
    console.error("Scheduled week results email check failed:", error);
  }
}

export function startCronLoop(): void {
  cron.schedule("*/15 * * * *", () => {
    tick().catch((error) => console.error("Cron tick failed:", error));
  });
}
