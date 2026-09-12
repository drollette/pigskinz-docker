import { getCurrentUser } from "@/lib/auth";
import { ColumnPage } from "@/components/column-page";
import type { ColumnTriple } from "@/lib/side-panels";
import { RulesView } from "@/components/rules-view";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { PicksView } from "@/components/picks-view";
import { ScheduleView } from "@/components/schedule-view";
import { NflStandingsView } from "@/components/nfl-standings-view";

const defaults: ColumnTriple = ["rules", "poolStandings", "lockerRoom"];

export default async function RulesPage() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <ColumnPage
      defaults={defaults}
      pin={{ slot: 0, type: "rules" }}
      signedIn={!!user}
      saved={user?.preferences?.columns}
      panels={{
        rules: <RulesView />,
        poolStandings: <PoolStandingsView />,
        lockerRoom: <LockerRoomPanel />,
        picks: <PicksView />,
        schedule: <ScheduleView />,
        nflStandings: <NflStandingsView />,
      }}
    />
  );
}
