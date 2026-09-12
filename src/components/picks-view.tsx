import { getCurrentUser } from "@/lib/auth";
import { getCurrentWeekFromDb } from "@/lib/data";
import { getWeekPicksData } from "@/lib/week-picks";
import { PicksWeekNavigator } from "@/components/picks-week-navigator";
import { WeekPicksList } from "@/components/week-picks-list";
import { withRetry } from "@/lib/with-retry";

interface PicksViewProps {
  seasonType?: number;
  weekNumber?: number;
}

/** The full picks-making UI -- any week, from the route, or (with no props)
 * the current week when offered as one of a column's selectable views. */
export async function PicksView({ seasonType, weekNumber }: PicksViewProps) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const current =
    seasonType && weekNumber ? { seasonType, week: weekNumber } : await withRetry(() => getCurrentWeekFromDb());
  const resolvedSeasonType = seasonType ?? current.seasonType;
  const resolvedWeek = weekNumber ?? current.week;

  const data = await withRetry(() => getWeekPicksData(user, resolvedSeasonType, resolvedWeek));

  return (
    <>
      <PicksWeekNavigator currentWeek={resolvedWeek} currentSeasonType={resolvedSeasonType} />
      <div className="flex flex-col items-center">
        <WeekPicksList user={user} weekNumber={resolvedWeek} seasonType={resolvedSeasonType} data={data} />
      </div>
    </>
  );
}
