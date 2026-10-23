"use client";

import { useState } from "react";
import { cn, favoredSide, formatRecordStreak } from "@/lib/utils";
import { formatGameDate, formatGameTime } from "@/lib/utils";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { GameData } from "@/lib/data";

interface PickInfo {
  userId: string;
  userName: string | null;
  username: string | null;
  avatar: string | null;
  teamId: string;
  isCorrect: boolean | null;
}

interface RosterUser {
  id: string;
  name: string;
  username: string | null;
}

interface ResultsGameCardProps {
  game: GameData;
  currentUserId: string;
  picks: PickInfo[];
  allUsers: RosterUser[];
  hasGameStarted: boolean;
}

export function ResultsGameCard({
  game,
  currentUserId,
  picks,
  allUsers,
  hasGameStarted,
}: ResultsGameCardProps) {
  const gameDate = new Date(game.date);

  // Group picks by team
  const homeTeamPicks = picks.filter(p => p.teamId === game.homeTeam.id);
  const awayTeamPicks = picks.filter(p => p.teamId === game.awayTeam.id);

  // Get current user's pick
  const currentUserPick = picks.find(p => p.userId === currentUserId);

  // Determine if we should show picks (game has started or completed)
  const showAllPicks = hasGameStarted || game.completed;

  // Same "spread shown under whichever team it favors" treatment as
  // game-view-card.tsx's picks page -- players asked to see the favorite
  // here too rather than having to cross-reference the picks page.
  const favorite = favoredSide(game.odds, game.homeTeam.abbreviation, game.awayTeam.abbreviation);
  const spreadValue = game.odds?.trim().replace(/^\S+\s*/, "") || null;

  // Same reveal timing as everyone else's picks -- showing who's missing
  // one pre-kickoff would leak other players' pick status earlier than the
  // rest of this card already allows.
  const pickedUserIds = new Set(picks.map((p) => p.userId));
  const missingUsers = showAllPicks ? allUsers.filter((u) => !pickedUserIds.has(u.id)) : [];

  const logoUrl = (team: { abbreviation: string; logo?: string | null }) =>
    team.logo || `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`;

  return (
    <div className="card w-full m-3 p-4 max-w-3xl bg-base-100">
      <div className="flex justify-between items-start">
        <h2 className="card-title text-base @sm:text-lg font-semibold text-base-content">
          {game.shortName}
        </h2>
        {!showAllPicks && (
          <div className="flex items-center gap-1 text-xs text-base-content/50">
            <EyeOff className="w-4 h-4" />
            <span>Hidden until kickoff</span>
          </div>
        )}
        {showAllPicks && !game.completed && (
          <div className="flex items-center gap-1 text-xs text-success">
            <Eye className="w-4 h-4" />
            <span>In Progress</span>
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-base-content/60 mt-1">
        <span>{formatGameDate(gameDate)}</span>
        <span>{formatGameTime(gameDate)}</span>
      </div>

      {/* Score display if game started */}
      {(hasGameStarted || game.completed) && (
        <div className="bg-base-200 rounded-lg mt-3 overflow-hidden">
          {/* Score row */}
          <div className="flex justify-center items-center gap-4 p-3">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(game.awayTeam)}
                alt={game.awayTeam.abbreviation}
                className="w-8 h-8 object-contain"
              />
              <span className={cn(
                "text-xl font-bold tabular-nums",
                game.completed && game.awayTeam.isWinner && "text-success"
              )}>
                {game.awayTeam.score ?? "-"}
              </span>
            </div>
            <div className="text-center">
              {game.completed ? (
                <span className="text-base-content/50">Final</span>
              ) : (
                <span className="text-success text-xs">Live</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xl font-bold tabular-nums",
                game.completed && game.homeTeam.isWinner && "text-success"
              )}>
                {game.homeTeam.score ?? "-"}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(game.homeTeam)}
                alt={game.homeTeam.abbreviation}
                className="w-8 h-8 object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Picks grid */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Away Team Picks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex flex-col items-center shrink-0">
              {favorite === "away" && spreadValue && (
                <span className="text-[9px] leading-none text-base-content/50">{spreadValue}</span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(game.awayTeam)}
                alt={game.awayTeam.abbreviation}
                className="w-6 h-6 object-contain"
              />
              {formatRecordStreak(game.awayTeam.record, game.awayTeam.streak) && (
                <span className="text-[8px] leading-none font-mono text-base-content/50 whitespace-nowrap">
                  {formatRecordStreak(game.awayTeam.record, game.awayTeam.streak)}
                </span>
              )}
            </div>
            <span className="font-medium text-sm">{game.awayTeam.abbreviation}</span>
            {showAllPicks && (
              <span className="text-xs text-base-content/50">({awayTeamPicks.length})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {showAllPicks ? (
              awayTeamPicks.map((pick) => (
                <PickAvatar
                  key={pick.userId}
                  name={pick.userName || "Unknown"}
                  username={pick.username}
                  avatar={pick.avatar}
                  isCurrentUser={pick.userId === currentUserId}
                  isCorrect={pick.isCorrect}
                  gameCompleted={game.completed}
                />
              ))
            ) : (
              // Show only current user's pick if they picked this team
              awayTeamPicks
                .filter(p => p.userId === currentUserId)
                .map((pick) => (
                  <PickAvatar
                    key={pick.userId}
                    name={pick.userName || "You"}
                    username="You"
                    avatar={pick.avatar}
                    isCurrentUser={true}
                    isCorrect={null}
                    gameCompleted={false}
                  />
                ))
            )}
          </div>
        </div>

        {/* Home Team Picks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex flex-col items-center shrink-0">
              {favorite === "home" && spreadValue && (
                <span className="text-[9px] leading-none text-base-content/50">{spreadValue}</span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(game.homeTeam)}
                alt={game.homeTeam.abbreviation}
                className="w-6 h-6 object-contain"
              />
              {formatRecordStreak(game.homeTeam.record, game.homeTeam.streak) && (
                <span className="text-[8px] leading-none font-mono text-base-content/50 whitespace-nowrap">
                  {formatRecordStreak(game.homeTeam.record, game.homeTeam.streak)}
                </span>
              )}
            </div>
            <span className="font-medium text-sm">{game.homeTeam.abbreviation}</span>
            {showAllPicks && (
              <span className="text-xs text-base-content/50">({homeTeamPicks.length})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {showAllPicks ? (
              homeTeamPicks.map((pick) => (
                <PickAvatar
                  key={pick.userId}
                  name={pick.userName || "Unknown"}
                  username={pick.username}
                  avatar={pick.avatar}
                  isCurrentUser={pick.userId === currentUserId}
                  isCorrect={pick.isCorrect}
                  gameCompleted={game.completed}
                />
              ))
            ) : (
              // Show only current user's pick if they picked this team
              homeTeamPicks
                .filter(p => p.userId === currentUserId)
                .map((pick) => (
                  <PickAvatar
                    key={pick.userId}
                    name={pick.userName || "You"}
                    username="You"
                    avatar={pick.avatar}
                    isCurrentUser={true}
                    isCorrect={null}
                    gameCompleted={false}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      {/* Players with no pick for this game -- spans both columns above */}
      {missingUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-base-200">
          <span className="text-xs text-base-content/50 self-center mr-0.5">No pick:</span>
          {missingUsers.map((u) => (
            <span key={u.id} className="badge badge-ghost badge-xs">
              {u.username || u.name}
            </span>
          ))}
        </div>
      )}

      {/* Current user's pick indicator if game hasn't started */}
      {!showAllPicks && !currentUserPick && (
        <div className="text-center text-xs text-warning mt-3">
          You haven't made a pick for this game
        </div>
      )}
    </div>
  );
}

// Shows an avatar in place of a name; hover (desktop) or tap (any device)
// reveals the username underneath, so a row of picks reads as faces first
// and only shows text once someone actually wants to know who's who.
function PickAvatar({
  name,
  username,
  avatar,
  isCurrentUser,
  isCorrect,
  gameCompleted,
}: {
  name: string;
  username: string | null;
  avatar: string | null;
  isCurrentUser: boolean;
  isCorrect: boolean | null;
  gameCompleted: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const label = username || name;

  return (
    <div className={cn("relative inline-flex", revealed && "z-20")}>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        title={label}
        aria-label={label}
        // Padding grows the actual tap target past the 24px avatar itself
        // (to ~32px) without enlarging it visually in this dense a grid --
        // the ring lives on this padded box too, so neighboring rings don't
        // read as overlapping once the row's own gap is added on top.
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center p-1 rounded-full transition-transform hover:z-10 focus:z-10 active:scale-95",
          "ring-2 ring-offset-2 ring-offset-base-100",
          gameCompleted && isCorrect === true && "ring-success",
          gameCompleted && isCorrect === false && "ring-error",
          !gameCompleted && isCurrentUser && "ring-primary",
          !gameCompleted && !isCurrentUser && "ring-transparent"
        )}
      >
        <Avatar name={name} avatar={avatar} seed={username} size="xs" />
        {gameCompleted && isCorrect !== null && (
          <span
            className={cn(
              "absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 rounded-full p-0.5",
              "ring-2 ring-base-100",
              isCorrect ? "bg-success text-success-content" : "bg-error text-error-content"
            )}
          >
            {isCorrect ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
          </span>
        )}
      </button>
      {revealed && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded bg-base-300 px-1.5 py-0.5 text-[10px] leading-tight text-base-content shadow">
          {label}
        </span>
      )}
    </div>
  );
}
