"use client";

import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from "react";
import toast from "react-hot-toast";
import { Trash2, Reply as ReplyIcon, X, Pencil, Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatGameTime } from "@/lib/utils";
import { useWebSocket, type GameRoomMessage, type ChatReplyPayload } from "@/hooks/use-websocket";
import { sendChatMessageAction, deleteChatMessageAction, editChatMessageAction } from "./actions";
import type { ChatMentionCandidate } from "@/lib/data";
import { splitMessageForMentions } from "@/lib/mentions";

interface ChatUser {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  isAdmin: boolean;
}

interface DisplayMessage {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  isAdmin: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
  replyTo: ChatReplyPayload | null;
}

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MENTION_SUGGESTIONS = 6;

interface MentionQuery {
  query: string;
  /** Index of the "@" itself within `draft`. */
  start: number;
}

/** Finds an in-progress "@partial" token ending exactly at the cursor, if
 * any -- an "@" that's either at the very start of the text or preceded by
 * whitespace, with no whitespace between it and the cursor. Typing a space
 * after the "@" (or moving the cursor away) ends the mention attempt. */
function detectMentionQuery(value: string, cursorPos: number): MentionQuery | null {
  const beforeCursor = value.slice(0, cursorPos);
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if (!match) return null;
  const query = match[1];
  return { query, start: beforeCursor.length - query.length - 1 };
}

/** Highlights only the @mentions that actually do something -- "admin" or a
 * real admin's username (which may contain spaces) -- so the highlight
 * doesn't imply an email went out when it didn't (mentioning an ordinary
 * player is just text now, not a notification). */
function renderMessageBody(body: string, candidateUsernames: string[]) {
  return splitMessageForMentions(body, candidateUsernames).map((seg, i) =>
    seg.isMention ? (
      <span key={i} className="text-primary font-medium">
        {seg.text}
      </span>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    )
  );
}

const ALL_ADMINS_OPTION: ChatMentionCandidate = {
  id: "__all_admins__",
  username: "admin",
  name: "All Administrators",
  avatar: null,
};

export function LockerRoomChat({
  currentUser,
  initialMessages,
  mentionCandidates,
}: {
  currentUser: ChatUser;
  initialMessages: DisplayMessage[];
  mentionCandidates: ChatMentionCandidate[];
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatReplyPayload | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);
  const prevLengthRef = useRef(initialMessages.length);

  // "@admin" (fan out to every admin) is always offered alongside specific
  // admins' own usernames, since either is a valid way to reach one.
  const mentionOptions = useMemo(
    () => [ALL_ADMINS_OPTION, ...mentionCandidates],
    [mentionCandidates]
  );
  const mentionUsernames = useMemo(() => mentionOptions.map((c) => c.username), [mentionOptions]);

  const mentionSuggestions = mentionQuery
    ? mentionOptions
        .filter(
          (c) =>
            c.id !== currentUser.id &&
            c.username.toLowerCase().startsWith(mentionQuery.query.toLowerCase())
        )
        .slice(0, MAX_MENTION_SUGGESTIONS)
    : [];

  const handleMessage = useCallback((message: GameRoomMessage) => {
    if (message.type === "chat_message" && message.chatMessage) {
      const incoming = message.chatMessage;
      setMessages((prev) =>
        prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
      );
    } else if (message.type === "chat_delete" && message.chatMessageId) {
      const deletedId = message.chatMessageId;
      setMessages((prev) => prev.filter((m) => m.id !== deletedId));
    } else if (message.type === "chat_edit" && message.chatMessageId && message.body !== undefined) {
      const editedId = message.chatMessageId;
      const newBody = message.body;
      const newEditedAt = message.editedAt ?? null;
      setMessages((prev) =>
        prev.map((m) => (m.id === editedId ? { ...m, body: newBody, editedAt: newEditedAt } : m))
      );
    }
  }, []);

  const { isConnected, connectedUsers } = useWebSocket({
    roomId: "locker-room",
    userId: currentUser.id,
    onMessage: handleMessage,
  });

  // Scrolls only the chat's own message list, never `Element.scrollIntoView`
  // -- that walks every scrollable ancestor in the containing-block chain
  // (this list, ColumnPage's own per-column scroll area, and ultimately the
  // page/window itself), and with no `scroll-margin`/`scroll-padding`
  // reserved for the sticky nav that outermost hop can land the target
  // flush against the real top of the document -- which the sticky nav
  // then visually covers, since it overlays that same strip rather than
  // occupying space the layout knows to avoid. Confirmed directly: with
  // every `scrollIntoView` call in this file stubbed out, the page-level
  // scroll offset this caused (previously 100% reproducible on load) never
  // happened. `Element.scrollTo()` only ever scrolls the element it's
  // called on, so it can't leak out to the page no matter how this chat is
  // embedded (a full-width page, or one column of three).
  const scrollMessages = useCallback((top: number, behavior: ScrollBehavior) => {
    messagesContainerRef.current?.scrollTo({ top, behavior });
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior) => {
      const container = messagesContainerRef.current;
      if (!container) return;
      scrollMessages(container.scrollHeight, behavior);
    },
    [scrollMessages]
  );

  const scrollToMessageEl = useCallback(
    (id: string, behavior: ScrollBehavior) => {
      const container = messagesContainerRef.current;
      const target = document.getElementById(`message-${id}`);
      if (!container || !target) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const delta =
        targetRect.top - containerRect.top - container.clientHeight / 2 + targetRect.height / 2;
      scrollMessages(container.scrollTop + delta, behavior);
    },
    [scrollMessages]
  );

  useEffect(() => {
    // Runs once: either jump to and briefly highlight the message a
    // notification email's "Reply in Locker Room" link points at
    // (/locker-room#message-<id>), or just drop the reader at the bottom.
    // Depends on `messages` (not just []) because the hash's target might
    // not be in the DOM yet on the very first render.
    if (initializedRef.current) return;
    if (messages.length === 0 && !window.location.hash) return;
    initializedRef.current = true;

    const match = window.location.hash.match(/^#message-(.+)$/);
    const targetId = match?.[1];
    const target = targetId ? document.getElementById(`message-${targetId}`) : null;

    if (target && targetId) {
      scrollToMessageEl(targetId, "smooth");
      setHighlightedId(targetId);
      setTimeout(() => setHighlightedId(null), 2500);
    } else {
      scrollToBottom("auto");
    }
  }, [messages, scrollToMessageEl, scrollToBottom]);

  useEffect(() => {
    // Once initial positioning is done, a growing message list (a new
    // message arrived) pulls the view to the bottom; a shrinking one (an
    // admin deleted a message) shouldn't move the scroll position at all.
    if (initializedRef.current && messages.length > prevLengthRef.current) {
      scrollToBottom("smooth");
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const result = await sendChatMessageAction(trimmed, replyingTo?.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      setReplyingTo(null);
      setMentionQuery(null);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    const detected = detectMentionQuery(value, e.target.selectionStart);
    setMentionQuery(detected);
    setMentionIndex(0);
  };

  const selectMention = (username: string) => {
    if (!mentionQuery) return;
    const end = mentionQuery.start + 1 + mentionQuery.query.length;
    const inserted = `@${username} `;
    const newValue = draft.slice(0, mentionQuery.start) + inserted + draft.slice(end);
    setDraft(newValue);
    setMentionQuery(null);

    const cursorPos = mentionQuery.start + inserted.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!confirm("Delete this message?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const result = await deleteChatMessageAction(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      // Remove locally right away rather than waiting on the chat_delete
      // broadcast to round-trip back to this same client -- the WebSocket
      // update is still what removes it for everyone else connected.
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const startEdit = (m: DisplayMessage) => {
    setEditing({ id: m.id, draft: m.body });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing || savingEdit) return;
    const trimmed = editing.draft.trim();
    if (!trimmed) {
      toast.error("Message can't be empty");
      return;
    }
    const id = editing.id;
    setSavingEdit(true);
    try {
      const result = await editChatMessageAction(id, trimmed);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      // Apply locally right away rather than waiting on the chat_edit
      // broadcast to round-trip back to this same client -- the WebSocket
      // update is still what applies it for everyone else connected.
      const editedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, body: trimmed, editedAt } : m))
      );
      setEditing(null);
    } catch {
      toast.error("Failed to edit message");
    } finally {
      setSavingEdit(false);
    }
  };

  const startReply = (m: DisplayMessage) => {
    setReplyingTo({
      id: m.id,
      name: m.name,
      username: m.username,
      bodySnippet: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
    });
    textareaRef.current?.focus();
  };

  const scrollToMessage = (id: string) => {
    scrollToMessageEl(id, "smooth");
  };

  return (
    <div className="flex flex-col border border-base-300 rounded-lg bg-base-100 h-[70vh]">
      <div className="px-4 py-2 border-b border-base-300 text-xs text-base-content/60 flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${isConnected ? "bg-success" : "bg-base-300"}`}
        />
        {isConnected ? `Live — ${connectedUsers} online` : "Connecting…"}
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-base-content/60 text-center py-8">
            No messages yet. Say something.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            id={`message-${m.id}`}
            className={`flex items-start gap-3 rounded-lg transition-colors -mx-2 px-2 py-1 ${
              highlightedId === m.id ? "bg-primary/10" : ""
            }`}
          >
            <Avatar name={m.name} avatar={m.avatar} seed={m.username ?? m.userId} size="sm" />
            <div className="min-w-0 flex-1">
              {m.replyTo && (
                <button
                  onClick={() => scrollToMessage(m.replyTo!.id)}
                  className="flex items-center gap-1 text-xs text-base-content/50 hover:text-base-content/80 mb-0.5 max-w-full"
                >
                  <ReplyIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {m.replyTo.username ?? m.replyTo.name}: {m.replyTo.bodySnippet}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{m.username ?? m.name}</span>
                {m.isAdmin && <span className="badge badge-primary badge-xs">Admin</span>}
                <span className="text-xs text-base-content/50">
                  {formatGameTime(new Date(m.createdAt))}
                </span>
                {m.editedAt && (
                  <span className="text-xs text-base-content/40">(edited)</span>
                )}
              </div>
              {editing?.id === m.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <textarea
                    className="textarea textarea-bordered textarea-sm flex-1 min-h-[2rem] resize-none"
                    value={editing.draft}
                    maxLength={MAX_MESSAGE_LENGTH}
                    disabled={savingEdit}
                    autoFocus
                    onChange={(e) => setEditing({ id: m.id, draft: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                  />
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="text-base-content/40 hover:text-success"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    className="text-base-content/40 hover:text-error"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {renderMessageBody(m.body, mentionUsernames)}
                </p>
              )}
            </div>
            {editing?.id !== m.id && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startReply(m)}
                  className="text-base-content/40 hover:text-primary"
                  title="Reply"
                >
                  <ReplyIcon className="w-4 h-4" />
                </button>
                {m.userId === currentUser.id && (
                  <button
                    onClick={() => startEdit(m)}
                    className="text-base-content/40 hover:text-primary"
                    title="Edit message"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {(currentUser.isAdmin || m.userId === currentUser.id) && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingIds.has(m.id)}
                    className="text-base-content/40 hover:text-error disabled:opacity-40"
                    title="Delete message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {replyingTo && (
        <div className="px-3 pt-2 flex items-center justify-between gap-2 text-xs text-base-content/60 border-t border-base-300">
          <span className="truncate">
            Replying to <span className="font-medium">{replyingTo.username ?? replyingTo.name}</span>: {replyingTo.bodySnippet}
          </span>
          <button onClick={() => setReplyingTo(null)} className="shrink-0 hover:text-base-content">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className={`p-3 flex gap-2 items-end relative ${replyingTo ? "" : "border-t border-base-300"}`}>
        {mentionQuery && (
          <div className="absolute bottom-full left-3 mb-1 w-56 border border-base-300 rounded-lg bg-base-100 shadow-lg overflow-hidden z-10">
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => selectMention(c.username)}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === mentionIndex ? "bg-primary/10" : "hover:bg-base-200"
                  }`}
                >
                  <Avatar name={c.name} avatar={c.avatar} seed={c.username} size="xs" />
                  <span className="font-medium shrink-0">@{c.username}</span>
                  {c.id !== ALL_ADMINS_OPTION.id && (
                    <span className="badge badge-primary badge-xs shrink-0">Admin</span>
                  )}
                  <span className="text-base-content/50 truncate min-w-0">{c.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-base-content/50">
                No matching admins -- mentions only reach admins
              </p>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="textarea textarea-bordered flex-1 min-h-[2.5rem] max-h-32 resize-none"
          placeholder="Say something... (@admin to reach the admins)"
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
          onChange={handleDraftChange}
          onKeyDown={(e) => {
            if (mentionSuggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                selectMention(mentionSuggestions[mentionIndex].username);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            } else if (mentionQuery && e.key === "Escape") {
              e.preventDefault();
              setMentionQuery(null);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={!draft.trim() || sending} loading={sending}>
          Send
        </Button>
      </div>
    </div>
  );
}
