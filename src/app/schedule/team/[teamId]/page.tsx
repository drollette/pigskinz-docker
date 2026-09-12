import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getGamesForTeam, getAllTeams, getTeamById } from "@/lib/data";
import { GameViewCard, ContentShell } from "@/components";
import { PoolStandingsView } from "@/components/pool-standings-view";
import { LockerRoomPanel } from "@/components/locker-room-panel";
import { PicksView } from "@/components/picks-view";
import { ScheduleView } from "@/components/schedule-view";
import { NflStandingsView } from "@/components/nfl-standings-view";
import { RulesView } from "@/components/rules-view";
import { TeamScheduleHeader } from "./team-schedule-header";

export const dynamic = "force-dynamic";

interface TeamSchedulePageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamSchedulePage({ params }: TeamSchedulePageProps) {
  const { teamId } = await params;

  // Fetch team and games
  const [team, teams, gamesBySeasonType] = await Promise.all([
    getTeamById(teamId),
    getAllTeams(),
    getGamesForTeam(teamId),
  ]);

  if (!team) {
    redirect("/schedule");
  }

  const user = await getCurrentUser().catch(() => null);

  const { preseason, regularSeason, postseason } = gamesBySeasonType;
  const hasPreseason = preseason.length > 0;
  const hasRegularSeason = regularSeason.length > 0;
  const hasPostseason = postseason.length > 0;

  return (
    <ContentShell
      excluded={null}
      defaultLeft="poolStandings"
      defaultRight="lockerRoom"
      signedIn={!!user}
      saved={user?.preferences?.sidePanels}
      panels={{
        poolStandings: <PoolStandingsView />,
        lockerRoom: <LockerRoomPanel />,
        picks: <PicksView />,
        schedule: <ScheduleView />,
        nflStandings: <NflStandingsView />,
        rules: <RulesView />,
      }}
    >
    <div>
      <TeamScheduleHeader team={team} teams={teams} />

      <div className="flex flex-col items-center mx-4">
        {/* Preseason Section */}
        {hasPreseason && (
          <section className="w-full max-w-3xl mb-8">
            <h2 className="text-xl font-bold text-base-content mb-4 border-b border-base-300 pb-2">
              Preseason
            </h2>
            <div className="flex flex-col items-center">
              {preseason.map((game) => (
                <GameViewCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* Regular Season Section */}
        {hasRegularSeason && (
          <section className="w-full max-w-3xl mb-8">
            <h2 className="text-xl font-bold text-base-content mb-4 border-b border-base-300 pb-2">
              Regular Season
            </h2>
            <div className="flex flex-col items-center">
              {regularSeason.map((game) => (
                <GameViewCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* Postseason Section */}
        {hasPostseason && (
          <section className="w-full max-w-3xl mb-8">
            <h2 className="text-xl font-bold text-base-content mb-4 border-b border-base-300 pb-2">
              Postseason
            </h2>
            <div className="flex flex-col items-center">
              {postseason.map((game) => (
                <GameViewCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* No games message */}
        {!hasPreseason && !hasRegularSeason && !hasPostseason && (
          <div className="text-center py-12">
            <p className="text-xl text-base-content/70">
              No games found for this team.
            </p>
          </div>
        )}
      </div>
    </div>
    </ContentShell>
  );
}
