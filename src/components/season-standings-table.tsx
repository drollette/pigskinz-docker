import { Trophy, Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { getOverallStandings } from "@/lib/data";

type StandingsEntry = Awaited<ReturnType<typeof getOverallStandings>>[number];

interface SeasonStandingsTableProps {
  standings: StandingsEntry[];
  currentUserId: string;
}

// Column visibility tracks the table's own container width (it can render
// anywhere from a full-width page down to one of three equal columns), not
// the viewport -- @sm:/@lg: rather than sm:/lg:.
export function SeasonStandingsTable({
  standings,
  currentUserId,
}: SeasonStandingsTableProps) {
  if (standings.length === 0) {
    return (
      <p className="text-base-content/60 text-center py-8">
        No picks data yet. Make some picks to see standings!
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra table-fixed table-xs @lg:table-md">
        <thead>
          <tr className="bg-base-200">
            <th className="w-10 text-center">Rank</th>
            <th>Player</th>
            <th className="w-16 text-center">Points</th>
            <th className="w-16 text-center hidden @sm:table-cell">Correct</th>
            <th className="w-16 text-center hidden @lg:table-cell">Weeks</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player) => (
            <tr key={player.userId} className={cn(player.userId === currentUserId && "bg-primary/10")}>
              <td className="text-center">
                {player.rank === 1 ? (
                  <Trophy className="w-5 h-5 text-yellow-500 mx-auto" />
                ) : player.rank === 2 ? (
                  <Medal className="w-5 h-5 text-gray-400 mx-auto" />
                ) : player.rank === 3 ? (
                  <Medal className="w-5 h-5 text-amber-600 mx-auto" />
                ) : (
                  <span className="text-base-content/60">{player.rank}</span>
                )}
              </td>
              <td>
                <div className="flex items-center gap-3">
                  <Avatar name={player.userName ?? "?"} avatar={player.avatar} seed={player.username ?? player.userId} size="sm" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{player.username}</div>
                  </div>
                </div>
              </td>
              <td className="text-center">
                <div className="font-semibold text-lg">{player.points}</div>
                <div
                  className={cn(
                    "text-xs",
                    player.winRate >= 60 && "text-success",
                    player.winRate >= 40 && player.winRate < 60 && "text-warning",
                    player.winRate < 40 && "text-error"
                  )}
                >
                  {player.winRate}%
                </div>
              </td>
              <td className="text-center hidden @sm:table-cell">
                <div className="font-medium">{player.correctPicks}</div>
                {/* Same denominator as the Points % above -- every game
                    graded this season, not just the ones this player
                    actually picked, so skipping a pick can't inflate their
                    percentage the way dividing by their own pick count did. */}
                <div className="text-xs text-base-content/50">
                  of {player.totalGradedGames}
                </div>
              </td>
              <td className="text-center hidden @lg:table-cell">{player.weeksPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
