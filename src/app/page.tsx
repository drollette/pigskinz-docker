import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RedirectNotice } from "@/components";
import { ColumnPage } from "@/components/column-page";
import type { ColumnTriple } from "@/lib/side-panels";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { PicksView } from "@/components/picks-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { ScheduleView } from "@/components/schedule-view";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { RulesView } from "@/components/rules-view";
import { POOL_NAME } from "@/lib/site-config";

const REDIRECT_NOTICES: Record<string, string> = {
  "admin-required": "You don't have access to that page.",
};

interface HomePageProps {
  searchParams?: Promise<{ week?: string; seasonType?: string; notice?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 text-base-content">
          {POOL_NAME}
        </h1>

        <p className="text-base-content/60 mb-8 max-w-md">
          Weekly NFL pick &apos;em.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/register">
            <Button variant="primary" size="lg" className="min-w-[160px]">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="min-w-[160px]">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const search = searchParams ? await searchParams : {};
  const seasonType = search.seasonType ? parseInt(search.seasonType) : undefined;
  const weekNumber = search.week ? parseInt(search.week) : undefined;

  const defaults: ColumnTriple = ["poolStandings", "picks", "lockerRoom"];

  return (
    <div className="space-y-6">
      <RedirectNotice message={search.notice ? (REDIRECT_NOTICES[search.notice] ?? null) : null} />
      <ColumnPage
        defaults={defaults}
        pin={{ slot: 0, type: "poolStandings" }}
        signedIn
        saved={user.preferences?.columns}
        panels={{
          poolStandings: <PoolStandingsView seasonType={seasonType} weekNumber={weekNumber} />,
          picks: <PicksView />,
          lockerRoom: <LockerRoomPanel />,
          schedule: <ScheduleView />,
          nflStandings: <NflStandingsView />,
          rules: <RulesView />,
        }}
      />
    </div>
  );
}
