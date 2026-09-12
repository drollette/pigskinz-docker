import { GameScheduleCard } from "@/components/game-schedule-card";
import { TiebreakerCard } from "@/components/tiebreaker-card";
import type { getWeekPicksData } from "@/lib/week-picks";
import type { User } from "@/db/schema";

interface WeekPicksListProps {
  user: User;
  weekNumber: number;
  seasonType: number;
  data: Awaited<ReturnType<typeof getWeekPicksData>>;
}

/** Renders a week's game cards + tiebreaker card -- shared by the full
 * Picks page (any week) and, via PicksView, any other column that offers
 * "picks" as one of its selectable views. */
export function WeekPicksList({ user, weekNumber, seasonType, data }: WeekPicksListProps) {
  const {
    isInactive,
    games,
    tiebreakerGame,
    takenTiebreakerValues,
    userSummary,
    allTiebreakerPredictions,
    tiebreakerRevealed,
    userPicks,
  } = data;

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-base-content/70">
          No games scheduled for this week.
        </p>
      </div>
    );
  }

  return (
    <>
      {isInactive && (
        <div className="alert alert-warning max-w-3xl mx-auto">
          <span>
            Your account is currently inactive, so you can view this page but can&apos;t make or
            change picks. Contact an admin to reactivate your account.
          </span>
        </div>
      )}

      {games.map((game) => (
        <GameScheduleCard
          key={game.id}
          game={game}
          userId={isInactive ? undefined : user.id}
          userPick={userPicks[game.id]?.teamId}
          userPickCorrect={userPicks[game.id]?.isCorrect ?? null}
          userAvatar={user.avatar}
          userName={user.name}
          weekNumber={weekNumber}
          seasonType={seasonType}
        />
      ))}

      {tiebreakerGame && (
        <TiebreakerCard
          game={tiebreakerGame}
          weekNumber={weekNumber}
          seasonType={seasonType}
          currentUserId={user.id}
          currentPrediction={userSummary?.tiebreakerPrediction ?? null}
          takenValues={takenTiebreakerValues}
          disabled={!user || isInactive}
          allPredictions={allTiebreakerPredictions}
          revealed={tiebreakerRevealed}
        />
      )}
    </>
  );
}
