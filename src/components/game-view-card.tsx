"use client";

import { HelpCircle } from "lucide-react";
import { cn, favoredSide } from "@/lib/utils";
import { formatGameDate, formatGameTime } from "@/lib/utils";
import { blackOpsOne } from "@/lib/fonts";
import type { GameData } from "@/lib/data";

interface GameViewCardProps {
  game: GameData;
}

// Check if a team is TBD (to be determined)
function isTeamTBD(team: { abbreviation: string; name: string }): boolean {
  const abbr = team.abbreviation.toUpperCase();
  const name = team.name.toUpperCase();
  return abbr === "TBD" || name.includes("TBD") || name === "TO BE DETERMINED";
}

export function GameViewCard({ game }: GameViewCardProps) {
  const gameDate = new Date(game.date);
  const isScheduled = game.statusName === "STATUS_SCHEDULED";

  // Check if either team is TBD
  const awayIsTBD = isTeamTBD(game.awayTeam);
  const homeIsTBD = isTeamTBD(game.homeTeam);
  const isTBDGame = awayIsTBD || homeIsTBD;

  // The spread portion of "CIN -3.5" (everything after the abbreviation),
  // shown under whichever team it actually favors rather than as a
  // standalone line that isn't visually tied to either side.
  const favorite = favoredSide(game.odds, game.homeTeam.abbreviation, game.awayTeam.abbreviation);
  const spreadValue = game.odds?.trim().replace(/^\S+\s*/, "") || null;

  return (
    <div className={cn(
      "card w-full m-3 p-4 max-w-3xl bg-base-100",
      isTBDGame && "opacity-60"
    )}>
      <h2 className="card-title flex justify-between">
        <span className="text-base @sm:text-lg font-semibold text-base-content">
          {game.name}
        </span>
      </h2>

      <div className="flex justify-between text-xs @sm:text-sm text-base-content/60 mt-1">
        <span>{formatGameDate(gameDate)}</span>
        <span>{formatGameTime(gameDate)}</span>
      </div>

      <div
        className={cn(
          "flex flex-row justify-between items-center p-3 @sm:p-4 bg-base-200 rounded-lg mt-3",
          !isScheduled && "opacity-75"
        )}
      >
        {/* Away Team */}
        <div className="flex flex-col items-center gap-2 flex-1">
          {awayIsTBD ? (
            <>
              <HelpCircle className="w-14 h-14 @sm:w-20 @sm:h-20 text-base-content/30" />
              <span className="text-xs @sm:text-sm font-medium text-base-content/50 text-center">
                TBD
              </span>
            </>
          ) : (
            <>
              <img
                src={game.awayTeam.logo ?? ""}
                alt={game.awayTeam.name}
                className="w-14 h-14 @sm:w-20 @sm:h-20 object-contain"
              />
              <span className="text-xs @sm:text-sm font-medium text-base-content text-center">
                {game.awayTeam.abbreviation}
              </span>
              {favorite === "away" && spreadValue && (
                <span className="text-[10px] @sm:text-xs text-base-content/50">{spreadValue}</span>
              )}
              {game.completed && (
                <span className="text-lg @sm:text-xl font-bold text-base-content tabular-nums">
                  {game.awayTeam.score}
                </span>
              )}
            </>
          )}
        </div>

        {/* VS indicator + over/under -- the spread itself renders under the
            favored team's own tile above instead. */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span
            className={cn(
              blackOpsOne.className,
              "text-4xl @sm:text-6xl leading-none",
              isTBDGame ? "text-base-content/30" : "text-base-content/50"
            )}
          >
            @
          </span>
          {!game.completed && !isTBDGame && game.overUnder && (
            <span className="text-[10px] @sm:text-xs text-base-content/50 whitespace-nowrap">
              O/U: {game.overUnder}
            </span>
          )}
          {!game.completed && !isTBDGame && !favorite && game.odds !== "Odds Not Available" && (
            <span className="text-[10px] @sm:text-xs text-base-content/50 whitespace-nowrap">
              {game.odds}
            </span>
          )}
        </div>

        {/* Home Team */}
        <div className="flex flex-col items-center gap-2 flex-1">
          {homeIsTBD ? (
            <>
              <HelpCircle className="w-14 h-14 @sm:w-20 @sm:h-20 text-base-content/30" />
              <span className="text-xs @sm:text-sm font-medium text-base-content/50 text-center">
                TBD
              </span>
            </>
          ) : (
            <>
              <img
                src={game.homeTeam.logo ?? ""}
                alt={game.homeTeam.name}
                className="w-14 h-14 @sm:w-20 @sm:h-20 object-contain"
              />
              <span className="text-xs @sm:text-sm font-medium text-base-content text-center">
                {game.homeTeam.abbreviation}
              </span>
              {favorite === "home" && spreadValue && (
                <span className="text-[10px] @sm:text-xs text-base-content/50">{spreadValue}</span>
              )}
              {game.completed && (
                <span className="text-lg @sm:text-xl font-bold text-base-content tabular-nums">
                  {game.homeTeam.score}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Final indicator */}
      {game.completed && (
        <div className="text-center text-sm text-base-content/70 mt-2 uppercase tracking-wide">
          Final
          {game.awayTeam.score === game.homeTeam.score ? " · Tie" : ""}
        </div>
      )}

      {/* TBD indicator */}
      {isTBDGame && !game.completed && (
        <div className="text-center text-xs @sm:text-sm text-base-content/50 mt-3">
          Teams to be determined
        </div>
      )}
    </div>
  );
}
