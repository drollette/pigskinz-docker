"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ResultsGameCard } from "./results-game-card";
import { useWebSocket, type GameRoomMessage } from "@/hooks/use-websocket";
import type { GameData } from "@/lib/data";
import { hasGameStarted } from "@/lib/game-helpers";

// Matches the cron loop that drives the ESPN sync (every 15 min, gated to
// skip when nothing's in progress) — see src/cron/index.ts.
const SCORE_SYNC_INTERVAL_MS = 15 * 60 * 1000;

interface PickInfo {
  userId: string;
  userName: string | null;
  username: string | null;
  avatar: string | null;
  teamId: string;
  isCorrect: boolean | null;
}

interface ResultsGameListProps {
  games: GameData[];
  currentUserId: string;
  picksByGame: Record<string, PickInfo[]>;
  seasonType: number;
  weekNumber: number;
}

export function ResultsGameList({
  games,
  currentUserId,
  picksByGame,
  seasonType,
  weekNumber,
}: ResultsGameListProps) {
  const router = useRouter();

  const hasGamesInProgress = games.some(
    (game) => hasGameStarted(game.date) && !game.completed
  );

  // Scores only land in the DB on the ~15-minute ESPN sync cadence, and
  // this page doesn't otherwise get pushed updates, so re-fetch on that
  // same cadence while a game's actually in progress.
  useEffect(() => {
    if (!hasGamesInProgress) return;
    const interval = setInterval(() => router.refresh(), SCORE_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasGamesInProgress, router]);

  // Handle WebSocket messages for real-time updates
  const handleWebSocketMessage = useCallback(
    (message: GameRoomMessage) => {
      if (
        message.type === "game_update" &&
        message.seasonType === seasonType &&
        message.weekNumber === weekNumber
      ) {
        // Re-fetch this page's server-rendered data (scores are synced into
        // the DB separately, via the GitHub-Actions-based ESPN sync).
        router.refresh();
      }
    },
    [seasonType, weekNumber, router]
  );

  // Connect to WebSocket for real-time updates
  useWebSocket({
    roomId: `week-${seasonType}-${weekNumber}`,
    onMessage: handleWebSocketMessage,
  });

  return (
    <>
      {hasGamesInProgress && (
        <div className="w-full max-w-3xl mb-3 flex items-center gap-2 text-xs text-base-content/60">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span>Scores update every 15 minutes</span>
        </div>
      )}

      {games.map((game) => (
        <ResultsGameCard
          key={game.id}
          game={game}
          currentUserId={currentUserId}
          picks={picksByGame[game.id] ?? []}
          hasGameStarted={hasGameStarted(game.date)}
        />
      ))}
    </>
  );
}
