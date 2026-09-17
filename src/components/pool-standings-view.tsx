import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getCurrentWeekFromDb,
  getGamesForWeek,
  getWeeklyStandings,
  getAllPicksForWeek,
  getTiebreakerGame,
  getOverallStandings,
  getFirstRegularSeasonGameDate,
  hasGameStarted,
} from "@/lib/data";
import { Card, CardBody, CardTitle } from "@/components/ui";
import { getSeasonTypeName } from "@/lib/utils";
import { HomeWeekNavigator } from "@/components/home-week-navigator";
import { Leaderboard } from "@/components/leaderboard";
import { ResultsGameList } from "@/components/results-game-list";
import { CountdownTimer } from "@/components/countdown-timer";
import { SeasonStandingsTable } from "@/components/season-standings-table";
import { withRetry } from "@/lib/with-retry";

interface PoolStandingsViewProps {
  seasonType?: number;
  weekNumber?: number;
}

/** The pool's season + weekly standings, with that week's per-game picks --
 * any week, from the route, or (with no props) the current week when
 * offered as one of a column's selectable views. */
export async function PoolStandingsView({ seasonType, weekNumber }: PoolStandingsViewProps) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const current =
    seasonType && weekNumber ? { seasonType, week: weekNumber } : await withRetry(() => getCurrentWeekFromDb());
  const resolvedSeasonType = seasonType ?? current.seasonType;
  const resolvedWeek = weekNumber ?? current.week;

  const [overallStandings, games, weeklyStandings, allPicks, tiebreakerGame, firstGameDate] =
    await withRetry(() =>
      Promise.all([
        getOverallStandings(resolvedSeasonType),
        getGamesForWeek(resolvedSeasonType, resolvedWeek),
        getWeeklyStandings(resolvedSeasonType, resolvedWeek),
        getAllPicksForWeek(resolvedSeasonType, resolvedWeek),
        getTiebreakerGame(resolvedSeasonType, resolvedWeek),
        getFirstRegularSeasonGameDate(),
      ])
    );

  const tiebreakerStarted = tiebreakerGame ? hasGameStarted(tiebreakerGame.date) : false;

  const leaderboardEntries = weeklyStandings.map((s, index) => ({
    rank: s.summary?.rank ?? index + 1,
    userId: s.user.id,
    userName: s.user.name,
    username: s.user.username,
    correctPicks: s.summary?.correctPicksCount ?? 0,
    totalPicks: s.summary?.totalPicksCount ?? 0,
    tiebreakerPrediction: s.summary?.tiebreakerPrediction ?? null,
    tiebreakerActual: s.summary?.tiebreakerActual ?? null,
    tiebreakerDiff: s.summary?.tiebreakerDiff ?? null,
    isCurrentUser: s.user.id === user.id,
  }));

  const picksByGame: Record<string, {
    userId: string;
    userName: string | null;
    username: string | null;
    avatar: string | null;
    teamId: string;
    isCorrect: boolean | null;
  }[]> = {};

  for (const { pick, user: pickUser } of allPicks) {
    const existing = picksByGame[pick.gameId] ?? [];
    existing.push({
      userId: pickUser.id,
      userName: pickUser.name,
      username: pickUser.username,
      avatar: pickUser.avatar,
      teamId: pick.teamId,
      isCorrect: pick.isCorrect,
    });
    picksByGame[pick.gameId] = existing;
  }

  return (
    <div className="space-y-6">
      {firstGameDate && (
        <CountdownTimer targetDate={firstGameDate} label="Time until season kickoff" />
      )}

      <HomeWeekNavigator currentWeek={resolvedWeek} currentSeasonType={resolvedSeasonType} />

      {/* Season Standings */}
      <Card>
        <CardBody>
          <CardTitle className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {getSeasonTypeName(resolvedSeasonType)} Standings
          </CardTitle>
          <SeasonStandingsTable standings={overallStandings} currentUserId={user.id} />
        </CardBody>
      </Card>

      {/* Weekly leaderboard + per-game results */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-3xl mb-6">
          <h2 className="text-xl font-semibold text-base-content mb-3">
            Week {resolvedWeek} Standings
          </h2>
          <Leaderboard
            entries={leaderboardEntries}
            showTiebreaker={tiebreakerGame !== null}
            tiebreakerRevealed={tiebreakerStarted}
          />
        </div>

        {games.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-base-content/70">
              No games scheduled for this week.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-base-content mb-3 w-full max-w-3xl">
              Picks by Game
            </h2>
            <ResultsGameList
              games={games}
              currentUserId={user.id}
              picksByGame={picksByGame}
              seasonType={resolvedSeasonType}
              weekNumber={resolvedWeek}
            />
          </>
        )}
      </div>
    </div>
  );
}
