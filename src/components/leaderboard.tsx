"use client";

import { cn } from "@/lib/utils";
import { Trophy, Medal, Lock } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string | null;
  username: string | null;
  correctPicks: number;
  totalPicks: number;
  tiebreakerPrediction: number | null;
  tiebreakerActual: number | null;
  tiebreakerDiff: number | null;
  isCurrentUser: boolean;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  /** Whether to show the tiebreaker columns at all */
  showTiebreaker?: boolean;
  /** Whether tiebreakers for ALL users are revealed (after last game starts) */
  tiebreakerRevealed?: boolean;
}

export function Leaderboard({
  entries,
  showTiebreaker = true,
  tiebreakerRevealed = false,
}: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="card bg-base-100 p-6">
        <p className="text-base-content/60 text-center">No results yet for this week.</p>
      </div>
    );
  }

  // Every entry shares the same actual tiebreaker total for the week —
  // show it once in the column header instead of repeating it on every row.
  const actualTotal = entries.find((e) => e.tiebreakerActual !== null)?.tiebreakerActual ?? null;

  return (
    <div className="@container card bg-base-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table table-zebra table-xs @sm:table-md table-fixed">
          <thead>
            <tr className="bg-base-200">
              <th className="text-center w-10">Rank</th>
              <th>Player</th>
              <th className="text-center w-14">Score</th>
              {showTiebreaker && (
                <>
                  <th className="text-center w-20">
                    Tiebreaker
                    {actualTotal !== null && (
                      <span className="block text-[10px] font-normal text-base-content/50">
                        Actual: {actualTotal}
                      </span>
                    )}
                  </th>
                  <th className="text-center w-14">Diff</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              // Show tiebreaker value if: current user OR tiebreakers are revealed
              const canSeeTiebreaker = entry.isCurrentUser || tiebreakerRevealed;

              return (
                <tr
                  key={entry.userId}
                  className={cn(
                    entry.isCurrentUser && "bg-primary/10"
                  )}
                >
                  <td className="text-center">
                    {entry.rank === 1 ? (
                      <Trophy className="w-5 h-5 text-yellow-500 mx-auto" />
                    ) : entry.rank === 2 ? (
                      <Medal className="w-5 h-5 text-gray-400 mx-auto" />
                    ) : entry.rank === 3 ? (
                      <Medal className="w-5 h-5 text-amber-600 mx-auto" />
                    ) : (
                      <span className="text-base-content/60">{entry.rank}</span>
                    )}
                  </td>
                  <td className="truncate">
                    <span className="font-medium">
                      {entry.username || "Unknown"}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="font-semibold text-lg">
                      {entry.correctPicks}
                    </span>
                    <span className="text-base-content/50 text-sm">
                      /{entry.totalPicks}
                    </span>
                  </td>
                  {showTiebreaker && (
                    <>
                      <td className="text-center">
                        {canSeeTiebreaker ? (
                          entry.tiebreakerPrediction !== null ? (
                            <span className="tabular-nums">{entry.tiebreakerPrediction}</span>
                          ) : (
                            <span className="text-base-content/40">-</span>
                          )
                        ) : (
                          <Lock className="w-3 h-3 text-base-content/40 mx-auto" />
                        )}
                      </td>
                      <td className="text-center">
                        {canSeeTiebreaker ? (
                          entry.tiebreakerDiff !== null ? (
                            <span className={cn(
                              "font-semibold tabular-nums",
                              entry.tiebreakerDiff === 0 && "text-success",
                              entry.tiebreakerDiff !== null && entry.tiebreakerDiff <= 3 && "text-warning"
                            )}>
                              {entry.tiebreakerDiff === 0 ? "Perfect!" : `±${entry.tiebreakerDiff}`}
                            </span>
                          ) : (
                            <span className="text-base-content/40">-</span>
                          )
                        ) : (
                          <span className="text-base-content/40">-</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
