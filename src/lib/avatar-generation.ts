import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "./env";
import { users } from "@/db/schema";

const DICEBEAR_TIMEOUT_MS = 5000;

// Chunked to avoid spreading a large Uint8Array into String.fromCharCode
// (risks blowing the call-stack argument limit on a big enough image).
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Fetches a DiceBear identicon PNG for `seed` and returns it as a data URL
 * -- the exact format the existing "upload a custom avatar" flow already
 * stores in users.avatar (see avatarSchema/updateAvatarAction), so a
 * generated default is indistinguishable at render time from a real
 * upload. Returns null on any failure (network, timeout, non-OK status);
 * DiceBear has no uptime guarantee and callers must never let that failure
 * block whatever they were actually doing (registering, renaming). */
export async function generateIdenticonDataUrl(seed: string): Promise<string | null> {
  try {
    const url = `https://api.dicebear.com/9.x/identicon/png?seed=${encodeURIComponent(seed)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DICEBEAR_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      return `data:image/png;base64,${base64}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(`generateIdenticonDataUrl: failed for seed "${seed}":`, error);
    return null;
  }
}

/**
 * Generates and persists a default avatar for a user, but only overwrites
 * a row that has no avatar yet or already holds a previously-generated one
 * -- a real user upload (avatarIsGenerated false/null, avatar non-null) is
 * never touched. Safe to call from registration (brand new user), a
 * username change (seed changed, previous identicon no longer matches),
 * or a one-off backfill (existing users with no avatar at all).
 *
 * Best-effort: swallows every failure internally (see
 * generateIdenticonDataUrl) so this can always be awaited inline without
 * risking the caller's own action.
 */
export async function ensureGeneratedAvatar(userId: string, seed: string): Promise<void> {
  const dataUrl = await generateIdenticonDataUrl(seed);
  if (!dataUrl) return;

  const db = getDb();
  await db
    .update(users)
    .set({ avatar: dataUrl, avatarIsGenerated: true, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.avatar), eq(users.avatarIsGenerated, true))
      )
    );
}
