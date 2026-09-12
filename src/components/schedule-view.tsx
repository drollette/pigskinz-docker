import { getCurrentWeekFromDb, getGamesForWeek, getAllTeams } from "@/lib/data";
import { GameViewCard } from "@/components/game-view-card";
import { ScheduleWeekNavigator } from "@/components/schedule-week-navigator";
import { withRetry } from "@/lib/with-retry";

interface ScheduleViewProps {
  /** Both omitted defaults to the current week -- the shape a dropdown pick
   * lands on; both given pins it to a specific week, e.g. a deep link into
   * /schedule/[seasonType]/[weekNum]. */
  seasonType?: number;
  weekNumber?: number;
}

/** The week-by-week schedule -- week/season navigation plus every game's
 * card, with no pick-making UI (see WeekPicksList for that). Used both as
 * ColumnPage's "schedule" view and, unmigrated, as the Schedule page's own
 * main content. `@container`-based sizing (see GameViewCard/
 * ScheduleWeekNavigator) so the same markup looks right whether this ends
 * up in a full-width page or one of three equal columns. */
export async function ScheduleView({ seasonType, weekNumber }: ScheduleViewProps) {
  const current =
    seasonType && weekNumber
      ? { seasonType, week: weekNumber }
      : await withRetry(() => getCurrentWeekFromDb());
  const resolvedSeasonType = seasonType ?? current.seasonType;
  const resolvedWeek = weekNumber ?? current.week;

  const [games, teams] = await withRetry(() =>
    Promise.all([getGamesForWeek(resolvedSeasonType, resolvedWeek), getAllTeams()])
  );

  return (
    <>
      <ScheduleWeekNavigator
        currentWeek={resolvedWeek}
        currentSeasonType={resolvedSeasonType}
        teams={teams}
        selectedTeamId={null}
      />
      <div className="flex flex-col items-center">
        {games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-base-content/70">No games scheduled for this week.</p>
          </div>
        ) : (
          games.map((game) => <GameViewCard key={game.id} game={game} />)
        )}
      </div>
    </>
  );
}
