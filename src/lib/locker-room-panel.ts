import { getRecentChatMessages, getChatMentionCandidates } from "@/lib/data";
import type { User } from "@/db/schema";

/** Shared data-fetching for anywhere the Locker Room chat renders -- the
 * dedicated /locker-room page and the persistent side panel shown on other
 * content pages both need the exact same shape. */
export async function getLockerRoomPanelProps(user: User) {
  const [messages, mentionCandidates] = await Promise.all([
    getRecentChatMessages(),
    getChatMentionCandidates(),
  ]);

  return {
    currentUser: {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      isAdmin: !!user.isAdmin,
    },
    mentionCandidates,
    initialMessages: messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      username: m.username,
      avatar: m.avatar,
      isAdmin: !!m.isAdmin,
      body: m.body,
      createdAt: (m.createdAt ?? new Date()).toISOString(),
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      replyTo: m.replyTo,
    })),
  };
}
