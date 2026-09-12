import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ColumnPage } from "@/components/column-page";
import type { ColumnTriple } from "@/lib/side-panels";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { PicksView } from "@/components/picks-view";
import { ScheduleView } from "@/components/schedule-view";
import { RulesView } from "@/components/rules-view";

const defaults: ColumnTriple = ["nflStandings", "poolStandings", "lockerRoom"];

export default async function NFLStandingsPage() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  return (
    <ColumnPage
      defaults={defaults}
      pin={{ slot: 0, type: "nflStandings" }}
      signedIn
      saved={user.preferences?.columns}
      panels={{
        nflStandings: <NflStandingsView />,
        poolStandings: <PoolStandingsView />,
        lockerRoom: <LockerRoomPanel />,
        picks: <PicksView />,
        schedule: <ScheduleView />,
        rules: <RulesView />,
      }}
    />
  );
}
