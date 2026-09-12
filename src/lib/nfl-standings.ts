import { TEAM_DIVISIONS, CONFERENCES, DIVISIONS, type Conference, type Division } from "@/lib/nfl-divisions";

export interface StandingsGameInput {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamScore: number | null;
  awayTeamScore: number | null;
  completed: boolean | null;
  seasonType: number;
  date: Date;
}

export interface StandingsTeamInput {
  id: string;
  abbreviation: string;
  name: string;
  displayName: string;
  logo: string | null;
}

export interface TeamStandingRow {
  teamId: string;
  abbreviation: string;
  name: string;
  displayName: string;
  logo: string | null;
  conference: Conference;
  division: Division;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  divisionRecord: string;
  conferenceRecord: string;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  streak: string;
  // Not displayed directly — used to resolve playoff-seeding tiebreaks.
  divWinPct: number;
  confWinPct: number;
  strengthOfVictory: number;
  strengthOfSchedule: number;
}

type Result = "W" | "L" | "T";
type HeadToHeadMap = Map<string, Map<string, { w: number; l: number; t: number }>>;

interface MutableStanding {
  wins: number;
  losses: number;
  ties: number;
  divWins: number;
  divLosses: number;
  divTies: number;
  confWins: number;
  confLosses: number;
  confTies: number;
  pointsFor: number;
  pointsAgainst: number;
  results: Result[]; // in chronological order, for streak calculation
  opponents: string[]; // every opponent's teamId, one entry per game played
}

function newStanding(): MutableStanding {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    divWins: 0,
    divLosses: 0,
    divTies: 0,
    confWins: 0,
    confLosses: 0,
    confTies: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    results: [],
    opponents: [],
  };
}

function recordHeadToHead(h2h: HeadToHeadMap, teamId: string, opponentId: string, result: Result) {
  if (!h2h.has(teamId)) h2h.set(teamId, new Map());
  const opponents = h2h.get(teamId)!;
  const existing = opponents.get(opponentId) ?? { w: 0, l: 0, t: 0 };
  if (result === "W") existing.w++;
  else if (result === "L") existing.l++;
  else existing.t++;
  opponents.set(opponentId, existing);
}

function applyResult(
  standing: MutableStanding,
  result: Result,
  opponentId: string,
  isDivisionGame: boolean,
  isConferenceGame: boolean
) {
  if (result === "W") standing.wins++;
  else if (result === "L") standing.losses++;
  else standing.ties++;

  if (isDivisionGame) {
    if (result === "W") standing.divWins++;
    else if (result === "L") standing.divLosses++;
    else standing.divTies++;
  }
  if (isConferenceGame) {
    if (result === "W") standing.confWins++;
    else if (result === "L") standing.confLosses++;
    else standing.confTies++;
  }

  standing.results.push(result);
  standing.opponents.push(opponentId);
}

function pct(wins: number, losses: number, ties: number): number {
  const total = wins + losses + ties;
  return total > 0 ? (wins + ties * 0.5) / total : 0;
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function computeStreak(results: Result[]): string {
  if (results.length === 0) return "-";
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) {
    count++;
  }
  return `${last}${count}`;
}

/**
 * Computes NFL regular-season standings (W-L-T, division/conference records,
 * points for/against, streak) directly from completed regular-season games —
 * no separate standings sync needed since every game we sync already carries
 * the scores this is derived from.
 */
export function computeNFLStandings(
  games: StandingsGameInput[],
  teams: StandingsTeamInput[]
): { rows: TeamStandingRow[]; headToHead: HeadToHeadMap } {
  const standings = new Map<string, MutableStanding>();
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  for (const team of teams) {
    standings.set(team.id, newStanding());
  }

  const headToHead: HeadToHeadMap = new Map();

  const regularSeasonGames = games
    .filter((g) => g.seasonType === 2 && g.completed && g.homeTeamScore !== null && g.awayTeamScore !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const game of regularSeasonGames) {
    const home = standings.get(game.homeTeamId);
    const away = standings.get(game.awayTeamId);
    if (!home || !away) continue; // team not in our reference set (shouldn't happen)

    const homeTeam = teamsById.get(game.homeTeamId);
    const awayTeam = teamsById.get(game.awayTeamId);
    const homeDivision = homeTeam ? TEAM_DIVISIONS[homeTeam.abbreviation] : undefined;
    const awayDivision = awayTeam ? TEAM_DIVISIONS[awayTeam.abbreviation] : undefined;
    const isDivisionGame = !!homeDivision && !!awayDivision &&
      homeDivision.conference === awayDivision.conference &&
      homeDivision.division === awayDivision.division;
    const isConferenceGame = !!homeDivision && !!awayDivision &&
      homeDivision.conference === awayDivision.conference;

    const homeScore = game.homeTeamScore as number;
    const awayScore = game.awayTeamScore as number;

    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;

    let homeResult: Result;
    let awayResult: Result;
    if (homeScore > awayScore) {
      homeResult = "W";
      awayResult = "L";
    } else if (awayScore > homeScore) {
      homeResult = "L";
      awayResult = "W";
    } else {
      homeResult = "T";
      awayResult = "T";
    }

    applyResult(home, homeResult, game.awayTeamId, isDivisionGame, isConferenceGame);
    applyResult(away, awayResult, game.homeTeamId, isDivisionGame, isConferenceGame);
    recordHeadToHead(headToHead, game.homeTeamId, game.awayTeamId, homeResult);
    recordHeadToHead(headToHead, game.awayTeamId, game.homeTeamId, awayResult);
  }

  // Strength of victory/schedule need every team's final win pct first, so
  // this is a second pass over the now-complete `standings` map.
  const finalWinPct = new Map<string, number>();
  for (const [teamId, s] of standings) {
    finalWinPct.set(teamId, pct(s.wins, s.losses, s.ties));
  }

  const rows: TeamStandingRow[] = [];
  for (const team of teams) {
    const divisionInfo = TEAM_DIVISIONS[team.abbreviation];
    if (!divisionInfo) continue; // skip anything not in the 32-team map (placeholder/pseudo teams)

    const s = standings.get(team.id)!;
    const winPct = pct(s.wins, s.losses, s.ties);

    let strengthOfVictory = 0;
    let strengthOfSchedule = 0;
    for (const opponentId of s.opponents) {
      strengthOfSchedule += finalWinPct.get(opponentId) ?? 0;
    }
    for (let i = 0; i < s.opponents.length; i++) {
      if (s.results[i] === "W") strengthOfVictory += finalWinPct.get(s.opponents[i]) ?? 0;
    }

    rows.push({
      teamId: team.id,
      abbreviation: team.abbreviation,
      name: team.name,
      displayName: team.displayName,
      logo: team.logo,
      conference: divisionInfo.conference,
      division: divisionInfo.division,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      winPct,
      divisionRecord: formatRecord(s.divWins, s.divLosses, s.divTies),
      conferenceRecord: formatRecord(s.confWins, s.confLosses, s.confTies),
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointDifferential: s.pointsFor - s.pointsAgainst,
      streak: computeStreak(s.results),
      divWinPct: pct(s.divWins, s.divLosses, s.divTies),
      confWinPct: pct(s.confWins, s.confLosses, s.confTies),
      strengthOfVictory,
      strengthOfSchedule,
    });
  }

  return { rows, headToHead };
}

export type StandingsByDivision = Record<Conference, Record<Division, TeamStandingRow[]>>;

/** Groups and sorts standings rows into conference -> division -> ranked teams. */
export function groupStandingsByDivision(rows: TeamStandingRow[], headToHead: HeadToHeadMap): StandingsByDivision {
  const grouped = {} as StandingsByDivision;

  for (const conference of CONFERENCES) {
    grouped[conference] = {} as Record<Division, TeamStandingRow[]>;
    for (const division of DIVISIONS) {
      const candidates = rows.filter((r) => r.conference === conference && r.division === division);
      grouped[conference][division] = rankTeams(candidates, headToHead);
    }
  }

  return grouped;
}

/**
 * Compares two teams on every tiebreaker *except* head-to-head: division
 * record (only meaningful between divisional opponents), conference record,
 * strength of victory, strength of schedule, then point differential. Every
 * one of these is a plain per-team number, so unlike head-to-head it always
 * produces a proper (transitive) ordering across any number of teams.
 */
function compareByScalarCriteria(a: TeamStandingRow, b: TeamStandingRow): number {
  if (a.division === b.division && a.conference === b.conference && b.divWinPct !== a.divWinPct) {
    return b.divWinPct - a.divWinPct;
  }
  if (b.confWinPct !== a.confWinPct) return b.confWinPct - a.confWinPct;
  if (b.strengthOfVictory !== a.strengthOfVictory) return b.strengthOfVictory - a.strengthOfVictory;
  if (b.strengthOfSchedule !== a.strengthOfSchedule) return b.strengthOfSchedule - a.strengthOfSchedule;
  if (b.pointDifferential !== a.pointDifferential) return b.pointDifferential - a.pointDifferential;
  return a.displayName.localeCompare(b.displayName);
}

/**
 * Approximates the NFL's tiebreaking procedure well enough for seeding
 * purposes: rank by win percentage, then within each group of teams tied on
 * win percentage, use head-to-head *only when exactly two teams are tied* —
 * head-to-head is a pairwise result, so with three or more tied teams it can
 * easily form a rock-paper-scissors cycle (A beat B, B beat C, C beat A)
 * that has no consistent order, which is exactly why the NFL's own rulebook
 * only applies it to a clean sweep among 3+ teams rather than every pair.
 * Detecting a sweep is more involved than this needs — skipping straight to
 * the scalar tiebreakers (division/conference record, strength of victory
 * and schedule, point differential) for any group larger than two gets the
 * right answer whenever head-to-head wasn't going to be a clean sweep
 * anyway, which is the common case. Also skips a few of the rulebook's
 * later steps entirely (common-games record, net points/touchdowns, coin
 * toss) since they're reached rarely. Good enough to get seeding right in
 * the overwhelming majority of real standings; not guaranteed spec-perfect
 * in rare multi-way tie scenarios.
 */
function rankTeams(candidates: TeamStandingRow[], headToHead: HeadToHeadMap): TeamStandingRow[] {
  const byWinPct = new Map<number, TeamStandingRow[]>();
  for (const team of candidates) {
    const bucket = byWinPct.get(team.winPct) ?? [];
    bucket.push(team);
    byWinPct.set(team.winPct, bucket);
  }

  const ranked: TeamStandingRow[] = [];
  for (const winPct of [...byWinPct.keys()].sort((a, b) => b - a)) {
    const group = byWinPct.get(winPct)!;

    if (group.length === 2) {
      const [a, b] = group;
      const aVsB = headToHead.get(a.teamId)?.get(b.teamId);
      if (aVsB && aVsB.w + aVsB.l + aVsB.t > 0) {
        const aH2H = pct(aVsB.w, aVsB.l, aVsB.t);
        if (aH2H !== 0.5) {
          ranked.push(...(aH2H > 0.5 ? [a, b] : [b, a]));
          continue;
        }
      }
    }

    group.sort(compareByScalarCriteria);
    ranked.push(...group);
  }

  return ranked;
}

export interface PlayoffSeed {
  seed: number; // 1-7
  team: TeamStandingRow;
  clinchType: "division" | "wildcard";
}

/** Seeds each conference's 7 playoff spots: the 4 division winners (1-4, by
 * record), then the best 3 remaining teams as wild cards (5-7). */
export function computePlayoffSeeding(
  standingsByDivision: StandingsByDivision,
  headToHead: HeadToHeadMap
): Record<Conference, PlayoffSeed[]> {
  const result = {} as Record<Conference, PlayoffSeed[]>;

  for (const conference of CONFERENCES) {
    const divisionWinners = DIVISIONS
      .map((division) => standingsByDivision[conference][division][0])
      .filter((team): team is TeamStandingRow => !!team);
    const divisionWinnerIds = new Set(divisionWinners.map((t) => t.teamId));

    const rankedDivisionWinners = rankTeams(divisionWinners, headToHead);

    const wildCardCandidates = rankTeams(
      DIVISIONS.flatMap((division) => standingsByDivision[conference][division]).filter(
        (team) => !divisionWinnerIds.has(team.teamId)
      ),
      headToHead
    ).slice(0, 3);

    const seeds: PlayoffSeed[] = [
      ...rankedDivisionWinners.map((team, i) => ({ seed: i + 1, team, clinchType: "division" as const })),
      ...wildCardCandidates.map((team, i) => ({ seed: i + 5, team, clinchType: "wildcard" as const })),
    ];

    result[conference] = seeds;
  }

  return result;
}
