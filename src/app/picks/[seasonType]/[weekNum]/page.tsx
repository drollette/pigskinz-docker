import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ColumnPage } from "@/components/column-page";
import type { ColumnTriple } from "@/lib/side-panels";
import { PicksView } from "@/components/picks-view";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { ScheduleView } from "@/components/schedule-view";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { RulesView } from "@/components/rules-view";

const defaults: ColumnTriple = ["picks", "poolStandings", "lockerRoom"];

interface PicksPageProps {
  params: Promise<{
    seasonType: string;
    weekNum: string;
  }>;
}

export default async function PicksWeekPage({ params }: PicksPageProps) {
  const { seasonType, weekNum } = await params;
  const seasonTypeNum = parseInt(seasonType);
  const weekNumber = parseInt(weekNum);

  // Validate params
  if (isNaN(seasonTypeNum) || isNaN(weekNumber)) {
    redirect("/");
  }

  const user = await getCurrentUser().catch(() => null);

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  return (
    <ColumnPage
      defaults={defaults}
      pin={{ slot: 0, type: "picks" }}
      signedIn
      saved={user.preferences?.columns}
      panels={{
        picks: <PicksView seasonType={seasonTypeNum} weekNumber={weekNumber} />,
        poolStandings: <PoolStandingsView />,
        lockerRoom: <LockerRoomPanel />,
        schedule: <ScheduleView />,
        nflStandings: <NflStandingsView />,
        rules: <RulesView />,
      }}
    />
  );
}
