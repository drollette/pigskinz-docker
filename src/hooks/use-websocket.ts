"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface ChatReplyPayload {
  id: string;
  name: string;
  username: string | null;
  bodySnippet: string;
}

export interface ChatMessagePayload {
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

export interface GameRoomMessage {
  type:
    | "join"
    | "leave"
    | "pick"
    | "score_update"
    | "game_update"
    | "connected"
    | "error"
    | "chat_message"
    | "chat_delete"
    | "chat_edit";
  userId?: string;
  gameId?: string;
  teamId?: string;
  score?: {
    homeScore: number;
    awayScore: number;
  };
  connectedUsers?: number;
  message?: string;
  seasonType?: number;
  weekNumber?: number;
  chatMessage?: ChatMessagePayload;
  chatMessageId?: string;
  body?: string;
  editedAt?: string;
}

interface UseWebSocketOptions {
  roomId?: string;
  userId?: string;
  gameId?: string;
  onMessage?: (message: GameRoomMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// The server side (src/realtime/locker-room.ts) keeps sessions in a plain
// in-memory Map, so a server restart or deploy closes every connection it's
// holding -- on top of the usual network blips, laptop sleep, and mobile
// tabs getting backgrounded. None of that is a "connection failed forever"
// case, just "reconnect", so the client needs to actually retry rather than
// sit on isConnected=false showing "Connecting..." until the user manually
// reloads the page.
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

export function useWebSocket({
  roomId = "global",
  userId,
  gameId,
  onMessage,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // Set right before a deliberate close (disconnect()/unmount) so onclose
  // knows not to schedule a reconnect for a close it was told to make.
  const closingDeliberatelyRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    clearReconnectTimeout();
    closingDeliberatelyRef.current = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams({ roomId });
    if (userId) params.set("userId", userId);
    if (gameId) params.set("gameId", gameId);

    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws?${params}`);

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as GameRoomMessage;

        if (message.connectedUsers !== undefined) {
          setConnectedUsers(message.connectedUsers);
        }

        onMessage?.(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();

      if (closingDeliberatelyRef.current) return;

      // Exponential backoff (1s, 2s, 4s, ... capped at 15s) rather than
      // hammering the DO immediately if it's mid-eviction/restart.
      const attempt = reconnectAttemptsRef.current;
      reconnectAttemptsRef.current = attempt + 1;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
      clearReconnectTimeout();
      reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, gameId, onMessage, onConnect, onDisconnect, clearReconnectTimeout]);

  const disconnect = useCallback(() => {
    closingDeliberatelyRef.current = true;
    clearReconnectTimeout();
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [clearReconnectTimeout]);

  const send = useCallback((message: GameRoomMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, disconnect]);

  // A backgrounded mobile tab (or a laptop waking from sleep) commonly has
  // its WebSocket silently dropped by the OS/browser without ever firing
  // onclose until the next send -- reconnecting as soon as the tab is
  // visible/back online again avoids waiting out the backoff timer for
  // something the user can already see should be live.
  useEffect(() => {
    const reconnectIfNeeded = () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reconnectIfNeeded();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", reconnectIfNeeded);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", reconnectIfNeeded);
    };
  }, [connect]);

  return {
    isConnected,
    connectedUsers,
    send,
    connect,
    disconnect,
  };
}
