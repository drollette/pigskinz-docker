import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ColumnPage } from "@/components/column-page";
import type { ColumnTriple } from "@/lib/side-panels";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { PicksView } from "@/components/picks-view";
import { ScheduleView } from "@/components/schedule-view";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { RulesView } from "@/components/rules-view";

const defaults: ColumnTriple = ["lockerRoom", "poolStandings", "picks"];

export default async function LockerRoomPage() {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    redirect("/login");
  }

  return (
    <ColumnPage
      defaults={defaults}
      pin={{ slot: 0, type: "lockerRoom" }}
      signedIn
      saved={user.preferences?.columns}
      panels={{
        lockerRoom: <LockerRoomPanel />,
        poolStandings: <PoolStandingsView />,
        picks: <PicksView />,
        schedule: <ScheduleView />,
        nflStandings: <NflStandingsView />,
        rules: <RulesView />,
      }}
    />
  );
}
