"use server";

import { requireAuth } from "@/lib/auth";
import { getDb, getEnv } from "@/lib/env";
import { chatMessages, users, type UserPreferences } from "@/db/schema";
import type { Database } from "@/db";
import type { AppEnv } from "@/lib/env";
import { generateId } from "@/lib/utils";
import { containsProfanity } from "@/lib/profanity";
import { sendLockerRoomNotificationEmail, type LockerRoomNotificationKind } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
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

function wantsLockerRoomPush(preferences: unknown): boolean {
  const prefs = (preferences ?? {}) as UserPreferences;
  const notif = prefs.pushNotifications;
  return (notif?.enabled ?? true) && (notif?.lockerRoomReplies ?? true);
}

function truncateForNotification(body: string, maxLength = 80): string {
  return body.length > maxLength ? `${body.slice(0, maxLength)}…` : body;
}

/**
 * Resolves who gets notified about a Locker Room message and through which
 * channel(s), then sends. Email stays admin-only -- this is still a "get an
 * admin's attention" channel there: @admin fans out to every admin,
 * @<username> reaches that admin specifically (a mention of a non-admin's
 * username is a no-op for email), and replying only counts when the
 * message being replied to was an admin's. Push is general: @mentioning or
 * replying to ANY user notifies that user, admin or not (see
 * getChatMentionCandidates in data.ts, widened to match). The sender is
 * excluded from both channels so nobody notifies themselves. Every email
 * sets Reply-To to the sender's own address, so an admin can just hit
 * "Reply" in their inbox to respond directly, entirely through normal
 * email; push instead links to /locker-room.
 */
async function notifyRecipients(
  db: Database,
  env: AppEnv,
  sender: { id: string; name: string; username: string | null; email: string },
  messageBody: string,
  replyToId: string | undefined
): Promise<void> {
  const [allUsers, replyToRow] = await Promise.all([
    // No isActive filter here -- a paused user (dues not paid) can still
    // log in and read the Locker Room per CLAUDE.md's "full pause" model,
    // and admins in particular were notified of mentions/replies
    // unconditionally before this widening existed. Filtering this query
    // would silently drop a paused admin from candidateUsernames entirely,
    // not just from notifications.
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        isAdmin: users.isAdmin,
        preferences: users.preferences,
      })
      .from(users),
    replyToId
      ? db.select({ userId: chatMessages.userId }).from(chatMessages).where(eq(chatMessages.id, replyToId)).limit(1)
      : Promise.resolve([]),
  ]);

  const candidateUsernames = ["admin", ...allUsers.map((u) => u.username).filter((u): u is string => !!u)];
  const mentionedUsernames = findMentionedUsernames(messageBody, candidateUsernames);
  const replyToAuthorId = replyToRow[0]?.userId;
  if (mentionedUsernames.size === 0 && !replyToAuthorId) return;

  const admins = allUsers.filter((u) => u.isAdmin);
  const mentionsAllAdmins = mentionedUsernames.has("admin");
  const usersByUsername = new Map(
    allUsers.filter((u) => u.username).map((u) => [u.username!.toLowerCase(), u])
  );

  const emailRecipients = new Map<string, LockerRoomNotificationKind>();
  for (const admin of admins) {
    if (admin.id === sender.id) continue;
    if (mentionsAllAdmins || (admin.username && mentionedUsernames.has(admin.username.toLowerCase()))) {
      emailRecipients.set(admin.id, "mention");
    }
  }
  if (replyToAuthorId && replyToAuthorId !== sender.id && admins.some((a) => a.id === replyToAuthorId)) {
    emailRecipients.set(replyToAuthorId, "reply");
  }

  const pushRecipients = new Map<string, LockerRoomNotificationKind>();
  if (mentionsAllAdmins) {
    for (const admin of admins) {
      if (admin.id !== sender.id) pushRecipients.set(admin.id, "mention");
    }
  }
  for (const username of mentionedUsernames) {
    if (username === "admin") continue;
    const mentioned = usersByUsername.get(username);
    if (mentioned && mentioned.id !== sender.id) pushRecipients.set(mentioned.id, "mention");
  }
  if (replyToAuthorId && replyToAuthorId !== sender.id) {
    pushRecipients.set(replyToAuthorId, "reply");
  }

  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  for (const [userId, kind] of emailRecipients) {
    const recipient = usersById.get(userId);
    if (!recipient || !wantsLockerRoomEmail(recipient.preferences)) continue;

    try {
      await sendLockerRoomNotificationEmail(recipient.email, recipient.name, sender.name, messageBody, kind, env, {
        email: sender.email,
        name: sender.name,
      });
    } catch (error) {
      console.error(`Failed to send Locker Room ${kind} email to ${recipient.email}:`, error);
    }
  }

  for (const [userId, kind] of pushRecipients) {
    const recipient = usersById.get(userId);
    if (!recipient || !wantsLockerRoomPush(recipient.preferences)) continue;

    try {
      await sendPushToUser(db, env, userId, {
        title: kind === "reply" ? "New reply in Locker Room" : "Mentioned in Locker Room",
        // Same username-over-real-name convention as the chat UI itself
        // (see m.username ?? m.name in locker-room-chat.tsx) -- push reaches
        // any mentioned/replied-to user, not just admins, so it can't leak
        // a real name the Locker Room deliberately keeps anonymous.
        body: `${sender.username ?? sender.name}: ${truncateForNotification(messageBody)}`,
        url: "/locker-room",
      });
    } catch (error) {
      console.error(`Failed to send Locker Room ${kind} push to user ${userId}:`, error);
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
      await notifyRecipients(
        db,
        getEnv(),
        { id: user.id, name: user.name, username: user.username, email: user.email },
        trimmed,
        replyTo?.id
      );
    } catch (error) {
      // Never fail the send over a notification problem -- the message is
      // already saved and broadcast at this point.
      console.error("notifyRecipients error:", error);
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
