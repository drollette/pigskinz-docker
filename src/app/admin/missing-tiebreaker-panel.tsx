"use client";

import { Button } from "@/components/ui";
import { CountdownTimer } from "@/components";
import { getSeasonTypeName } from "@/lib/utils";
import type { CurrentWeekMissingTiebreaker } from "@/lib/data";

interface MissingTiebreakerPanelProps {
  data: CurrentWeekMissingTiebreaker | null;
  onEmailMissingUsers: (userIds: string[]) => void;
}

export function MissingTiebreakerPanel({ data, onEmailMissingUsers }: MissingTiebreakerPanelProps) {
  if (!data) {
    return (
      <p className="text-sm text-base-content/60">
        No upcoming tiebreaker game found, or this week&apos;s tiebreaker game has already started.
      </p>
    );
  }

  const { game, missingUsers } = data;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="font-medium">{game.shortName || game.name}</div>
          <div className="text-sm text-base-content/60">
            {getSeasonTypeName(game.seasonType)} &middot; Week {game.weekNumber} tiebreaker
          </div>
        </div>
        <CountdownTimer targetDate={game.date} label="Locks in" />
      </div>

      {missingUsers.length === 0 ? (
        <p className="text-sm text-success">Everyone has submitted a tiebreaker guess.</p>
      ) : (
        <>
          <div className="border border-base-300 rounded-lg divide-y divide-base-300 max-h-64 overflow-y-auto">
            {missingUsers.map((user) => (
              <div key={user.id} className="p-2 text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-base-content/60">{user.email}</div>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => onEmailMissingUsers(missingUsers.map((u) => u.id))}
          >
            Email these {missingUsers.length} player{missingUsers.length === 1 ? "" : "s"}
          </Button>
        </>
      )}
    </div>
  );
}
