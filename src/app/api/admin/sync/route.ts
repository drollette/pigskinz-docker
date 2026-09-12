import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/env";
import {
  syncTeams,
  syncGamesForWeek,
  syncFullSeason,
  updateCurrentWeekScores,
  updateWeekScores,
  recalculateAllPickResults,
  runScheduledSync,
} from "@/lib/sync-service";

// POST /api/admin/sync
// Body: { action: "teams" | "week" | "full" | "scores" | "picks" | "scheduled" }
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json() as { action?: string; seasonType?: number; week?: number };
    const { action, seasonType, week } = body;

    const db = getDb();
    let result;

    switch (action) {
      case "teams":
        result = await syncTeams(db);
        break;

      case "week":
        if (!seasonType || !week) {
          return NextResponse.json(
            { error: "seasonType and week are required for week sync" },
            { status: 400 }
          );
        }
        result = await syncGamesForWeek(db, seasonType, week);
        break;

      case "full":
        result = await syncFullSeason(db);
        break;

      case "scores":
        // If seasonType and week are provided, update that specific week
        // Otherwise, update the current week
        if (seasonType !== undefined && week !== undefined) {
          result = await updateWeekScores(db, seasonType, week);
        } else {
          result = await updateCurrentWeekScores(db);
        }
        break;

      case "picks":
        result = await recalculateAllPickResults(db);
        break;

      case "scheduled":
        result = await runScheduledSync(db);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: teams, week, full, scores, picks, or scheduled" },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin sync error:", error);

    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/sync - Get sync status/info
export async function GET() {
  try {
    await requireAdmin();

    return NextResponse.json({
      endpoints: {
        teams: "Sync all NFL teams",
        week: "Sync specific week (requires seasonType, week)",
        full: "Sync entire season (all weeks)",
        scores: "Update current week scores",
        picks: "Recalculate all pick results",
        scheduled: "Run scheduled sync (current + adjacent weeks)",
      },
      usage: "POST with { action: 'teams' | 'week' | 'full' | 'scores' | 'picks' | 'scheduled' }",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
