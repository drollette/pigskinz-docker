import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ColumnPage } from "@/components/column-page";
import { ScheduleView } from "@/components/schedule-view";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { PicksView } from "@/components/picks-view";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { RulesView } from "@/components/rules-view";

export const dynamic = "force-dynamic";

interface SchedulePageProps {
  params: Promise<{
    seasonType: string;
    weekNum: string;
  }>;
  searchParams: Promise<{
    team?: string;
  }>;
}

export default async function ScheduleWeekPage({
  params,
  searchParams,
}: SchedulePageProps) {
  const { seasonType, weekNum } = await params;
  const { team: selectedTeamId } = await searchParams;
  const seasonTypeNum = parseInt(seasonType);
  const weekNumber = parseInt(weekNum);

  // Validate params
  if (isNaN(seasonTypeNum) || isNaN(weekNumber)) {
    redirect("/schedule");
  }

  // Redirect to team schedule page if team is selected
  if (selectedTeamId) {
    redirect(`/schedule/team/${selectedTeamId}`);
  }

  const user = await getCurrentUser().catch(() => null);

  return (
    <ColumnPage
      defaults={["schedule", "poolStandings", "lockerRoom"]}
      pin={{ slot: 0, type: "schedule" }}
      signedIn={!!user}
      saved={user?.preferences?.columns}
      panels={{
        schedule: <ScheduleView seasonType={seasonTypeNum} weekNumber={weekNumber} />,
        poolStandings: <PoolStandingsView />,
        lockerRoom: <LockerRoomPanel />,
        picks: <PicksView />,
        nflStandings: <NflStandingsView />,
        rules: <RulesView />,
      }}
    />
  );
}
