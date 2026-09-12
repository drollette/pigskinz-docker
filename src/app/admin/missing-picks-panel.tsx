"use client";

import { Button } from "@/components/ui";
import { CountdownTimer } from "@/components";
import { getSeasonTypeName } from "@/lib/utils";
import type { NextGameMissingPicks } from "@/lib/data";

interface MissingPicksPanelProps {
  data: NextGameMissingPicks | null;
  onEmailMissingUsers: (userIds: string[]) => void;
}

export function MissingPicksPanel({ data, onEmailMissingUsers }: MissingPicksPanelProps) {
  if (!data) {
    return <p className="text-sm text-base-content/60">No upcoming game found.</p>;
  }

  const { game, missingUsers } = data;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="font-medium">{game.shortName || game.name}</div>
          <div className="text-sm text-base-content/60">
            {getSeasonTypeName(game.seasonType)} &middot; Week {game.weekNumber}
          </div>
        </div>
        <CountdownTimer targetDate={game.date} label="Kicks off in" />
      </div>

      {missingUsers.length === 0 ? (
        <p className="text-sm text-success">Everyone has picked this game.</p>
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
