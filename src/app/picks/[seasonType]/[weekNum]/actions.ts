"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { picks, picksSummary, games } from "@/db/schema";
import { createPickSchema } from "@/lib/schemas";
import { generateId } from "@/lib/utils";
import { getTiebreakerGame, getTakenTiebreakerValues } from "@/lib/data";
import { syncPicksSummaryCountForUser } from "@/lib/game-sync-core";
import { eq, and } from "drizzle-orm";

export async function createPickAction(data: {
  gameId: string;
  teamId: string;
  weekNumber: number;
  seasonType: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireAuth();

    if (!user.isActive) {
      return { success: false, error: "Your account is inactive. Contact an admin to reactivate it before making picks." };
    }

    const parsed = createPickSchema.safeParse(data);
    if (!parsed.success) {
      const errorMessage = parsed.error.issues.map(e => e.message).join(", ");
      return { success: false, error: `Invalid pick data: ${errorMessage}` };
    }

    const db = getDb();

    // Check if game has started (lock picks after game begins). Returned as
    // a result rather than thrown so the client shows this exact message —
    // Next.js redacts thrown-error messages from Server Actions in
    // production builds, which otherwise surfaces as a generic, scary
    // "Server Components render" error instead of a normal validation toast.
    const gameResult = await db
      .select()
      .from(games)
      .where(eq(games.id, parsed.data.gameId))
      .limit(1);

    if (gameResult.length === 0) {
      return { success: false, error: "Game not found" };
    }

    const game = gameResult[0];
    if (new Date() >= game.date) {
      return { success: false, error: "Picks are locked once a game has started" };
    }

    // Check if pick already exists for this game
    const existingPick = await db
      .select()
      .from(picks)
      .where(and(eq(picks.userId, user.id), eq(picks.gameId, parsed.data.gameId)))
      .limit(1);

    if (existingPick.length > 0) {
      // Update existing pick
      await db
        .update(picks)
        .set({
          teamId: parsed.data.teamId,
          updatedAt: new Date(),
        })
        .where(eq(picks.id, existingPick[0].id));
    } else {
      // Create new pick
      await db.insert(picks).values({
        id: generateId(),
        userId: user.id,
        gameId: parsed.data.gameId,
        teamId: parsed.data.teamId,
        weekNumber: parsed.data.weekNumber,
        seasonType: parsed.data.seasonType,
      });
    }

    // picks_summary only otherwise refreshes as a side effect of a game
    // completing (see updateWeeklyStandings) -- without this, a pick made
    // between completions either goes uncounted (no row exists yet) or
    // leaves the displayed total stale until the next game finishes.
    await syncPicksSummaryCountForUser(db, user.id, parsed.data.seasonType, parsed.data.weekNumber);

    revalidatePath(`/schedule/${parsed.data.seasonType}/${parsed.data.weekNumber}`);

    return { success: true };
  } catch (error) {
    console.error("createPickAction error:", error);
    return { success: false, error: "Failed to save pick" };
  }
}

export async function submitTiebreakerAction(data: {
  weekNumber: number;
  seasonType: number;
  prediction: number;
}) {
  try {
    const user = await requireAuth();

    if (!user.isActive) {
      throw new Error("Your account is inactive. Contact an admin to reactivate it before making picks.");
    }

    const { weekNumber, seasonType, prediction } = data;

    // Validate prediction is a reasonable number (0-200 total points)
    if (prediction < 0 || prediction > 200 || !Number.isInteger(prediction)) {
      throw new Error("Prediction must be a whole number between 0 and 200");
    }

    const db = getDb();

    // Get the tiebreaker game
    const tiebreakerGame = await getTiebreakerGame(seasonType, weekNumber);
    if (!tiebreakerGame) {
      throw new Error("No tiebreaker game found for this week");
    }

    // Check if tiebreaker game has already started
    if (new Date() >= tiebreakerGame.date) {
      throw new Error("Tiebreaker game has already started");
    }

    // Check if this prediction is already taken by another user
    const takenValues = await getTakenTiebreakerValues(seasonType, weekNumber, user.id);

    // Check if user already has this exact prediction (allow keeping same value)
    const existingSummary = await db
      .select()
      .from(picksSummary)
      .where(
        and(
          eq(picksSummary.userId, user.id),
          eq(picksSummary.seasonType, seasonType),
          eq(picksSummary.weekNumber, weekNumber)
        )
      )
      .limit(1);

    const userCurrentPrediction = existingSummary[0]?.tiebreakerPrediction;

    // Filter out user's own current prediction from taken values
    const takenByOthers = takenValues.filter(v => v !== userCurrentPrediction);

    if (takenByOthers.includes(prediction)) {
      throw new Error(`${prediction} points has already been selected by another player`);
    }

    if (existingSummary.length > 0) {
      // Update existing summary. tiebreakerSubmittedAt is set once and kept
      // on later edits — it's what breaks a tie between two different
      // predictions equally close to the actual total, in favor of whoever
      // predicted first, so revising a guess shouldn't reset it.
      await db
        .update(picksSummary)
        .set({
          tiebreakerGameId: tiebreakerGame.id,
          tiebreakerPrediction: prediction,
          tiebreakerSubmittedAt: existingSummary[0].tiebreakerSubmittedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(picksSummary.id, existingSummary[0].id));
    } else {
      // Create new summary
      await db.insert(picksSummary).values({
        id: generateId(),
        userId: user.id,
        weekNumber,
        seasonType,
        tiebreakerGameId: tiebreakerGame.id,
        tiebreakerPrediction: prediction,
        tiebreakerSubmittedAt: new Date(),
      });
    }

    revalidatePath(`/schedule/${seasonType}/${weekNumber}`);

    return { success: true };
  } catch (error) {
    console.error("submitTiebreakerAction error:", error);
    throw error;
  }
}
