"use client";

import { useState, useTransition } from "react";
import { HelpCircle } from "lucide-react";
import toast from "react-hot-toast";
import { cn, favoredSide } from "@/lib/utils";
import { formatGameDate, formatGameTime } from "@/lib/utils";
import { blackOpsOne } from "@/lib/fonts";
import { TeamCard } from "./team-card";
import { createPickAction } from "@/app/picks/[seasonType]/[weekNum]/actions";
import type { GameData } from "@/lib/data";

interface GameScheduleCardProps {
  game: GameData;
  userId?: string;
  userPick?: string; // teamId of user's pick for this game
  userPickCorrect?: boolean | null; // graded result of userPick, once the game is completed
  userAvatar?: string | null;
  userName?: string;
  weekNumber: number;
  seasonType: number;
}

// Check if a team is TBD (to be determined)
function isTeamTBD(team: { abbreviation: string; name: string }): boolean {
  const abbr = team.abbreviation.toUpperCase();
  const name = team.name.toUpperCase();
  return abbr === "TBD" || name.includes("TBD") || name === "TO BE DETERMINED";
}

export function GameScheduleCard({
  game,
  userId,
  userPick,
  userPickCorrect = null,
  userAvatar,
  userName,
  weekNumber,
  seasonType,
}: GameScheduleCardProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(userPick ?? null);

  // Check if either team is TBD
  const isTBDGame = isTeamTBD(game.homeTeam) || isTeamTBD(game.awayTeam);

  const isScheduled = game.statusName === "STATUS_SCHEDULED";
  // A game that's kicked off but isn't marked completed yet (in progress,
  // halftime, etc.) is locked just like a completed one — picks can no
  // longer be changed, so neither can the UI let you try.
  const isLocked = !isScheduled || game.completed;

  const handlePick = (teamId: string) => {
    if (!userId || isLocked || isTBDGame) return;

    setSelectedTeam(teamId);
    startTransition(async () => {
      const result = await createPickAction({
        gameId: game.id,
        teamId,
        weekNumber,
        seasonType,
      });
      if (result.success) {
        toast.success("Pick saved!");
      } else {
        toast.error(result.error);
        setSelectedTeam(userPick ?? null);
      }
    });
  };

  const gameDate = new Date(game.date);

  // The spread portion of "CIN -3.5" (everything after the abbreviation),
  // shown under whichever team it actually favors rather than as a
  // standalone line that isn't visually tied to either side.
  const favorite = favoredSide(game.odds, game.homeTeam.abbreviation, game.awayTeam.abbreviation);
  const spreadValue = game.odds?.trim().replace(/^\S+\s*/, "") || null;

  // Render TBD game card with special styling
  if (isTBDGame) {
    return (
      <div className="card w-full m-3 p-4 max-w-3xl bg-base-100 opacity-60">
        <h2 className="card-title flex justify-between">
          <span className="text-base @sm:text-lg font-semibold text-base-content">
            {game.name}
          </span>
        </h2>

        <div className="flex justify-between text-xs @sm:text-sm text-base-content/60 mt-1">
          <span>{formatGameDate(gameDate)}</span>
          <span>{formatGameTime(gameDate)}</span>
        </div>

        <div className="flex flex-row justify-between items-center bg-base-200 rounded-lg mt-3 p-4 @sm:p-6">
          {/* TBD Away Team */}
          <div className="flex flex-col items-center rounded-lg bg-base-300/50 flex-1 p-3 @sm:p-4 max-w-[120px]">
            <HelpCircle className="text-base-content/30 w-12 h-12 @sm:w-16 @sm:h-16" />
            <span className="font-medium text-base-content/50 mt-2 text-xs @sm:text-sm">
              TBD
            </span>
          </div>

          {/* VS indicator */}
          <span className={cn(blackOpsOne.className, "text-base-content/30 mx-2 text-3xl @sm:text-5xl")}>
            @
          </span>

          {/* TBD Home Team */}
          <div className="flex flex-col items-center rounded-lg bg-base-300/50 flex-1 p-3 @sm:p-4 max-w-[120px]">
            <HelpCircle className="text-base-content/30 w-12 h-12 @sm:w-16 @sm:h-16" />
            <span className="font-medium text-base-content/50 mt-2 text-xs @sm:text-sm">
              TBD
            </span>
          </div>
        </div>

        <div className="text-center text-base-content/50 mt-3 text-xs @sm:text-sm">
          Teams to be determined — picks available once matchup is set
        </div>
      </div>
    );
  }

  return (
    <div className="card w-full m-3 p-4 max-w-3xl bg-base-100">
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
          "flex flex-row justify-between items-center bg-base-200 rounded-lg mt-3 p-3 @sm:p-4",
          !isScheduled && "opacity-75"
        )}
      >
        {/* Away Team */}
        <TeamCard
          team={game.awayTeam}
          completed={game.completed}
          selected={selectedTeam === game.awayTeam.id}
          onClick={() => handlePick(game.awayTeam.id)}
          disabled={!userId || isPending || isLocked}
          userAvatar={selectedTeam === game.awayTeam.id ? userAvatar : undefined}
          userName={selectedTeam === game.awayTeam.id ? userName : undefined}
          userPickCorrect={userPickCorrect}
          spread={favorite === "away" ? spreadValue : null}
        />

        {/* VS indicator + over/under -- the spread itself renders under the
            favored team's own tile instead (see TeamCard's spread prop). */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className={cn(blackOpsOne.className, "text-base-content/50 leading-none text-4xl @sm:text-6xl")}>
            @
          </span>
          {game.overUnder && (
            <span className="text-[10px] @sm:text-xs text-base-content/50 whitespace-nowrap">
              O/U: {game.overUnder}
            </span>
          )}
          {!favorite && game.odds !== "Odds Not Available" && (
            <span className="text-[10px] @sm:text-xs text-base-content/50 whitespace-nowrap">
              {game.odds}
            </span>
          )}
        </div>

        {/* Home Team */}
        <TeamCard
          team={game.homeTeam}
          completed={game.completed}
          selected={selectedTeam === game.homeTeam.id}
          onClick={() => handlePick(game.homeTeam.id)}
          disabled={!userId || isPending || isLocked}
          userAvatar={selectedTeam === game.homeTeam.id ? userAvatar : undefined}
          userName={selectedTeam === game.homeTeam.id ? userName : undefined}
          userPickCorrect={userPickCorrect}
          spread={favorite === "home" ? spreadValue : null}
        />
      </div>

      {/* In-progress lock notice (completed games get the Final score box instead) */}
      {isLocked && !game.completed && (
        <div className="text-center text-xs @sm:text-sm text-warning mt-3">
          🔒 Picks locked — game in progress
        </div>
      )}

      {/* Final Score */}
      {game.completed && (
        <div className="flex justify-evenly items-center p-3 @sm:p-4 text-lg @sm:text-xl font-semibold bg-base-300 rounded-lg mt-3">
          <span className="text-base-content text-2xl @sm:text-3xl tabular-nums">
            {game.awayTeam.score}
          </span>
          <span className="text-base-content/70 text-sm uppercase tracking-wide">
            Final
            {game.awayTeam.score === game.homeTeam.score ? " · Tie" : ""}
          </span>
          <span className="text-base-content text-2xl @sm:text-3xl tabular-nums">
            {game.homeTeam.score}
          </span>
        </div>
      )}

      {/* Pick indicator */}
      {selectedTeam && !isLocked && (
        <div className="text-center text-xs @sm:text-sm text-primary mt-3">
          {isPending ? "Saving pick..." : "✓ Pick saved"}
        </div>
      )}
    </div>
  );
}
