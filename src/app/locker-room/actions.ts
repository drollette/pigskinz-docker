"use server";

import { requireAuth } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/env";
import { chatMessages, users, type UserPreferences } from "@/db/schema";
import type { Database } from "@/db";
import type { AppEnv } from "@/lib/env";
import { generateId } from "@/lib/utils";
import { containsProfanity } from "@/lib/profanity";
import { sendLockerRoomNotificationEmail, type LockerRoomNotificationKind } from "@/lib/email";
import { findMentionedUsernames } from "@/lib/mentions";
import { broadcastToLockerRoom } from "@/realtime/locker-room";
import { eq } from "drizzle-orm";

const MAX_MESSAGE_LENGTH = 1000;

function wantsLockerRoomEmail(preferences: unknown): boolean {
  const prefs = (preferences ?? {}) as UserPreferences;
  const notif = prefs.emailNotifications;
  // Opt-out, not opt-in, like every other notification toggle here -- both
  // default to true when unset so this reaches people who never touched
  // the setting, same as pickReminders/autoPickDigest.
  return (notif?.enabled ?? true) && (notif?.lockerRoomMentions ?? true);
}

/**
 * Locker Room @mentions/replies only ever email admins -- this is a "get an
 * admin's attention" channel, not a general player-to-player notification
 * system (see getChatMentionCandidates in data.ts for the matching
 * autocomplete restriction). @admin fans out to every admin; @<username>
 * reaches one specific admin; replying to a message an admin sent reaches
 * that admin too -- the sender is excluded from all three so nobody emails
 * themselves. Every email sets Reply-To to the sender's own address, so an
 * admin can just hit "Reply" in their inbox to respond directly to whoever
 * was trying to reach them, entirely through normal email.
 */
async function notifyAdmins(
  db: Database,
  env: AppEnv,
  sender: { id: string; name: string; email: string },
  messageBody: string,
  replyToId: string | undefined
): Promise<void> {
  const [admins, replyToRow] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, username: users.username, preferences: users.preferences })
      .from(users)
      .where(eq(users.isAdmin, true)),
    replyToId
      ? db.select({ userId: chatMessages.userId }).from(chatMessages).where(eq(chatMessages.id, replyToId)).limit(1)
      : Promise.resolve([]),
  ]);

  const candidateUsernames = ["admin", ...admins.map((a) => a.username).filter((u): u is string => !!u)];
  const mentionedUsernames = findMentionedUsernames(messageBody, candidateUsernames);
  if (mentionedUsernames.size === 0 && !replyToId) return;

  const recipientKind = new Map<string, LockerRoomNotificationKind>();

  const mentionsAllAdmins = mentionedUsernames.has("admin");
  for (const admin of admins) {
    if (admin.id === sender.id) continue;
    if (mentionsAllAdmins || (admin.username && mentionedUsernames.has(admin.username.toLowerCase()))) {
      recipientKind.set(admin.id, "mention");
    }
  }

  const replyToAuthorId = replyToRow[0]?.userId;
  if (replyToAuthorId && replyToAuthorId !== sender.id) {
    // Only counts if the message being replied to was an admin's -- a
    // reply to an ordinary player's message stays purely in-app.
    if (admins.some((a) => a.id === replyToAuthorId)) {
      recipientKind.set(replyToAuthorId, "reply");
    }
  }

  const adminsById = new Map(admins.map((a) => [a.id, a]));

  for (const [adminId, kind] of recipientKind) {
    const admin = adminsById.get(adminId);
    if (!admin || !wantsLockerRoomEmail(admin.preferences)) continue;

    try {
      await sendLockerRoomNotificationEmail(admin.email, admin.name, sender.name, messageBody, kind, env, {
        email: sender.email,
        name: sender.name,
      });
    } catch (error) {
      console.error(`Failed to send Locker Room ${kind} notification to ${admin.email}:`, error);
    }
  }
}

export async function sendChatMessageAction(
  body: string,
  replyToId?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireAuth();

    const trimmed = body.trim();
    if (!trimmed) {
      return { success: false, error: "Message can't be empty" };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` };
    }
    if (containsProfanity(trimmed)) {
      return { success: false, error: "Message contains language that isn't allowed" };
    }

    const db = getDb();
    const id = generateId();
    const createdAt = new Date();

    let replyTo: { id: string; name: string; username: string | null; bodySnippet: string } | null = null;
    if (replyToId) {
      const [parent] = await db
        .select({ id: chatMessages.id, body: chatMessages.body, name: users.name, username: users.username })
        .from(chatMessages)
        .innerJoin(users, eq(chatMessages.userId, users.id))
        .where(eq(chatMessages.id, replyToId))
        .limit(1);
      if (parent) {
        replyTo = {
          id: parent.id,
          name: parent.name,
          username: parent.username,
          bodySnippet: parent.body.length > 80 ? `${parent.body.slice(0, 80)}…` : parent.body,
        };
      }
    }

    await db.insert(chatMessages).values({
      id,
      userId: user.id,
      body: trimmed,
      replyToId: replyTo?.id,
      createdAt,
    });

    // Broadcast carries the full display payload (not just userId) so every
    // connected client gets name/avatar/admin-badge state without each one
    // making its own round trip back to the database.
    await broadcastToLockerRoom({
      type: "chat_message",
      chatMessage: {
        id,
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        isAdmin: !!user.isAdmin,
        body: trimmed,
        createdAt: createdAt.toISOString(),
        editedAt: null,
        replyTo,
      },
    });

    try {
      await notifyAdmins(db, getEnv(), { id: user.id, name: user.name, email: user.email }, trimmed, replyTo?.id);
    } catch (error) {
      // Never fail the send over a notification problem -- the message is
      // already saved and broadcast at this point.
      console.error("notifyAdmins error:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("sendChatMessageAction error:", error);
    return { success: false, error: "Failed to send message" };
  }
}

export async function deleteChatMessageAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireAuth();

    const db = getDb();
    const [message] = await db
      .select({ userId: chatMessages.userId })
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1);

    if (!message) {
      return { success: false, error: "Message not found" };
    }
    // Authors can delete their own messages; admins can delete anyone's.
    if (message.userId !== user.id && !user.isAdmin) {
      return { success: false, error: "You can only delete your own messages" };
    }

    // No DB-level FK for reply_to_id (see schema.ts) -- clear any row that
    // pointed at this one before deleting it, so a reply never dangles.
    await db.update(chatMessages).set({ replyToId: null }).where(eq(chatMessages.replyToId, id));
    await db.delete(chatMessages).where(eq(chatMessages.id, id));

    await broadcastToLockerRoom({ type: "chat_delete", chatMessageId: id });

    return { success: true };
  } catch (error) {
    console.error("deleteChatMessageAction error:", error);
    return { success: false, error: "Failed to delete message" };
  }
}

export async function editChatMessageAction(
  id: string,
  body: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await requireAuth();

    const trimmed = body.trim();
    if (!trimmed) {
      return { success: false, error: "Message can't be empty" };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` };
    }
    if (containsProfanity(trimmed)) {
      return { success: false, error: "Message contains language that isn't allowed" };
    }

    const db = getDb();
    const [message] = await db
      .select({ userId: chatMessages.userId })
      .from(chatMessages)
      .where(eq(chatMessages.id, id))
      .limit(1);

    if (!message) {
      return { success: false, error: "Message not found" };
    }
    // Editing is author-only -- unlike delete, admins don't get to edit
    // someone else's words on their behalf.
    if (message.userId !== user.id) {
      return { success: false, error: "You can only edit your own messages" };
    }

    const editedAt = new Date();
    await db
      .update(chatMessages)
      .set({ body: trimmed, editedAt })
      .where(eq(chatMessages.id, id));

    await broadcastToLockerRoom({
      type: "chat_edit",
      chatMessageId: id,
      body: trimmed,
      editedAt: editedAt.toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("editChatMessageAction error:", error);
    return { success: false, error: "Failed to edit message" };
  }
}
