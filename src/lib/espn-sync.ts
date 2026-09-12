// ESPN API sync functions for fetching NFL teams and schedule data

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

// ESPN's API rejects requests that don't look like they came from a browser
const ESPN_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

// Types for ESPN API responses
export interface ESPNTeamResponse {
  team: {
    id: string;
    name: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    color?: string;
    alternateColor?: string;
    logos?: Array<{ href: string }>;
  };
}

export interface ESPNTeamsResponse {
  sports: Array<{
    leagues: Array<{
      teams: ESPNTeamResponse[];
    }>;
  }>;
}

export interface ESPNCalendarEntry {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
}

export interface ESPNCalendarResponse {
  leagues: Array<{
    calendar: ESPNCalendarEntry[];
  }>;
}

// Parsed team type for database insertion
export interface ParsedTeam {
  id: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  color: string | null;
  alternateColor: string | null;
  logo: string | null;
}

// Parsed game type for database insertion
export interface ParsedGameForDb {
  id: string;
  name: string;
  shortName: string | null;
  date: Date;
  seasonType: number;
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamScore: number | null;
  awayTeamScore: number | null;
  completed: boolean;
  statusName: string;
  odds: string | null;
  overUnder: number | null;
}

/**
 * Fetch all 32 NFL teams from ESPN API
 */
export async function fetchAllTeams(): Promise<ParsedTeam[]> {
  const url = `${ESPN_BASE_URL}/teams`;
  const response = await fetch(url, { headers: ESPN_FETCH_HEADERS });

  if (!response.ok) {
    const body = await response.text();
    console.error("ESPN Teams API debug:", {
      status: response.status,
      cfRay: response.headers.get("cf-ray"),
      cfMitigated: response.headers.get("cf-mitigated"),
      server: response.headers.get("server"),
      contentType: response.headers.get("content-type"),
      body: body.slice(0, 500),
    });
    throw new Error(`ESPN Teams API error: ${response.status}`);
  }

  const data: ESPNTeamsResponse = await response.json();
  const teams = data.sports[0]?.leagues[0]?.teams ?? [];

  // ESPN's team list includes non-team entries alongside the 32 real
  // franchises: AFC/NFC conference pseudo-teams (whose "name" field comes
  // back as the literal string "null") and reserved "TBD" playoff-berth
  // placeholders. Filter those out rather than storing them as teams.
  const PLACEHOLDER_ABBREVIATIONS = new Set(["TBD", "AFC", "NFC"]);

  return teams
    .filter(
      (t) =>
        t.team.name &&
        t.team.name !== "null" &&
        !PLACEHOLDER_ABBREVIATIONS.has(t.team.abbreviation)
    )
    .map((t) => ({
      id: t.team.id,
      name: t.team.name,
      abbreviation: t.team.abbreviation,
      displayName: t.team.displayName,
      shortDisplayName: t.team.shortDisplayName,
      color: t.team.color ?? null,
      alternateColor: t.team.alternateColor ?? null,
      logo: t.team.logos?.[0]?.href ?? null,
    }));
}

/**
 * Fetch schedule for a specific week
 */
export async function fetchWeekSchedule(
  seasonType: number,
  week: number
): Promise<ParsedGameForDb[]> {
  const url = `${ESPN_BASE_URL}/scoreboard?seasontype=${seasonType}&week=${week}`;
  const response = await fetch(url, { headers: ESPN_FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(`ESPN Scoreboard API error: ${response.status}`);
  }

  const data = await response.json() as {
    events?: any[];
    season?: { type?: number };
    week?: { number?: number };
  };
  const events = data.events ?? [];

  return events.map((event: any) => {
    const competition = event.competitions[0];
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === "home");
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === "away");
    const odds = competition.odds?.[0];

    return {
      id: event.id,
      name: event.name,
      shortName: event.shortName ?? null,
      date: new Date(event.date),
      seasonType: data.season?.type ?? seasonType,
      weekNumber: data.week?.number ?? week,
      homeTeamId: homeTeam?.team?.id ?? "",
      awayTeamId: awayTeam?.team?.id ?? "",
      homeTeamScore: homeTeam?.score ? parseInt(homeTeam.score) : null,
      awayTeamScore: awayTeam?.score ? parseInt(awayTeam.score) : null,
      completed: event.status?.type?.completed ?? false,
      statusName: event.status?.type?.name ?? "STATUS_SCHEDULED",
      odds: odds?.details ?? null,
      overUnder: odds?.overUnder ?? null,
    };
  });
}

/**
 * Fetch current week data from ESPN
 */
export async function fetchCurrentWeek(): Promise<{
  week: number;
  seasonType: number;
  year: number;
}> {
  const url = `${ESPN_BASE_URL}/scoreboard`;
  const response = await fetch(url, { headers: ESPN_FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(`ESPN Scoreboard API error: ${response.status}`);
  }

  const data = await response.json() as {
    week?: { number?: number };
    season?: { type?: number; year?: number };
  };

  return {
    week: data.week?.number ?? 1,
    seasonType: data.season?.type ?? 2,
    year: data.season?.year ?? new Date().getFullYear(),
  };
}

/**
 * Get max weeks for each season type
 */
export function getMaxWeeksForSeasonType(seasonType: number): number {
  switch (seasonType) {
    case 1: return 4;  // Preseason
    case 2: return 18; // Regular season
    case 3: return 5;  // Postseason (Wild Card, Divisional, Conference, Pro Bowl, Super Bowl)
    default: return 18;
  }
}

/**
 * Fetch entire season schedule
 */
export async function fetchFullSeasonSchedule(
  year?: number
): Promise<ParsedGameForDb[]> {
  const allGames: ParsedGameForDb[] = [];

  // Fetch all season types
  const seasonTypes = [
    { type: 1, name: "Preseason" },
    { type: 2, name: "Regular Season" },
    { type: 3, name: "Postseason" },
  ];

  for (const season of seasonTypes) {
    const maxWeeks = getMaxWeeksForSeasonType(season.type);

    for (let week = 1; week <= maxWeeks; week++) {
      try {
        const games = await fetchWeekSchedule(season.type, week);
        allGames.push(...games);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching ${season.name} week ${week}:`, error);
        // Continue with other weeks even if one fails
      }
    }
  }

  return allGames;
}

/**
 * Fetch games that are currently in progress or recently completed
 * Used for live score updates
 */
export async function fetchLiveGames(): Promise<ParsedGameForDb[]> {
  const current = await fetchCurrentWeek();
  return fetchWeekSchedule(current.seasonType, current.week);
}
