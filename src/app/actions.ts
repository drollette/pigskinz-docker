"use server";

import { redirect } from "next/navigation";
import { destroySession, requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/env";
import { users, type UserPreferences, type SidePanelType } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPointsProgression, type UserPointsProgression } from "@/lib/data";

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function updateSidePanelsAction(
  left: SidePanelType,
  right: SidePanelType
): Promise<{ success: true } | { success: false; error: string }> {
  if (left === right) {
    return { success: false, error: "Left and right panels must be different" };
  }

  try {
    const user = await requireAuth();
    const db = getDb();

    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      sidePanels: { left, right },
    };

    await db
      .update(users)
      .set({ preferences: newPreferences, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    console.error("updateSidePanelsAction error:", error);
    return { success: false, error: "Failed to save layout" };
  }
}

export async function updateColumnsAction(
  columns: [SidePanelType, SidePanelType, SidePanelType]
): Promise<{ success: true } | { success: false; error: string }> {
  if (new Set(columns).size !== 3) {
    return { success: false, error: "All three columns must be different" };
  }

  try {
    const user = await requireAuth();
    const db = getDb();

    const currentPreferences = (user.preferences ?? {}) as UserPreferences;
    const newPreferences: UserPreferences = {
      ...currentPreferences,
      columns,
    };

    await db
      .update(users)
      .set({ preferences: newPreferences, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (error) {
    console.error("updateColumnsAction error:", error);
    return { success: false, error: "Failed to save layout" };
  }
}

// Fetched on demand (opening the season standings' "compare players" modal)
// rather than with the page load, since it's a heavier per-user/per-week
// computation the standings table itself doesn't need.
export async function getPointsProgressionAction(
  seasonType: number,
  userIds: string[]
): Promise<{ success: true; data: UserPointsProgression[] } | { success: false; error: string }> {
  try {
    await requireAuth();

    // Matches the chart's own display cap -- see PlayerCompareModal.
    const dedupedIds = Array.from(new Set(userIds)).slice(0, 8);
    if (dedupedIds.length === 0) {
      return { success: true, data: [] };
    }

    const data = await getPointsProgression(seasonType, dedupedIds);
    return { success: true, data };
  } catch (error) {
    console.error("getPointsProgressionAction error:", error);
    return { success: false, error: "Failed to load points comparison" };
  }
}
