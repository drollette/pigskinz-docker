// Runs the ESPN sync and season rollover directly against the database, by
// fetching ESPN from inside this process (see espn-client.ts) and handing
// the raw event data straight to game-sync-core.ts -- no external relay.
// Called from both the 5-minute cron loop (src/cron/index.ts) and the
// admin dashboard's "Sync Now"/"Season Rollover" buttons
// (src/app/admin/actions.ts).
import type { Database } from "../db";
import { syncEventsForWeek, rolloverSeason, type SyncWeekResult, type RolloverResult } from "./game-sync-core";
import { fetchCurrentAndAdjacentWeeks, fetchFullSeasonWeeks } from "./espn-client";
import { broadcast } from "../realtime/locker-room";

export interface SyncRunResult {
  seasonType: number;
  week: number;
  result: SyncWeekResult;
}

export async function runEspnSync(db: Database): Promise<SyncRunResult[]> {
  const weeks = await fetchCurrentAndAdjacentWeeks();
  const results: SyncRunResult[] = [];
  for (const w of weeks) {
    const result = await syncEventsForWeek(db, w.seasonType, w.week, w.events);
    results.push({ seasonType: w.seasonType, week: w.week, result });

    // Lets any open tab viewing that week's pool-standings/results view
    // (results-game-list.tsx's useWebSocket) refresh the instant a sync
    // lands, rather than waiting out its own 5-minute polling fallback.
    if (result.updated > 0 || result.inserted > 0) {
      broadcast({ type: "game_update", seasonType: w.seasonType, weekNumber: w.week });
    }
  }
  return results;
}

export async function runSeasonRollover(db: Database, seasonYear: number): Promise<RolloverResult> {
  const weeks = await fetchFullSeasonWeeks(seasonYear);
  return rolloverSeason(db, seasonYear, weeks);
}
