// Fetches raw NFL scoreboard data from ESPN's undocumented public API.
//
// The Cloudflare version this app was ported from could not call this
// directly from Worker-side code -- ESPN's edge (Akamai) blocks Cloudflare's
// egress IP ranges outright, which is why that version relayed the fetch
// through a GitHub Actions runner instead (see CLAUDE.md). Self-hosted here,
// there's no such block to work around: this container's own egress IP is
// whatever your host's is, so the fetch happens right here.
import { getMaxWeeksForSeasonType, type ESPNEventPayload } from "./game-sync-core";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

export interface ScoreboardWeek {
  seasonType: number;
  week: number;
  events: ESPNEventPayload[];
}

async function fetchScoreboard(seasonType?: number, week?: number): Promise<ESPNEventPayload> {
  const params = new URLSearchParams();
  if (seasonType && week) {
    params.set("seasontype", String(seasonType));
    params.set("week", String(week));
  }
  const query = params.toString();
  const url = `${ESPN_BASE}/scoreboard${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API error ${res.status} for ${url}`);
  }
  return res.json();
}

/** The current week plus its immediate neighbors -- covers games that just
 * wrapped up (previous week) and next week's odds/schedule as soon as
 * they're posted, on top of whatever's live right now. */
export async function fetchCurrentAndAdjacentWeeks(): Promise<ScoreboardWeek[]> {
  const current = await fetchScoreboard();
  const seasonType = current.season?.type ?? 2;
  const week = current.week?.number ?? 1;
  const maxWeeks = getMaxWeeksForSeasonType(seasonType);

  const weeksToFetch = [{ seasonType, week }];
  if (week > 1) weeksToFetch.push({ seasonType, week: week - 1 });
  if (week < maxWeeks) weeksToFetch.push({ seasonType, week: week + 1 });

  const weeks: ScoreboardWeek[] = [];
  for (const w of weeksToFetch) {
    const data =
      w.seasonType === seasonType && w.week === week ? current : await fetchScoreboard(w.seasonType, w.week);
    weeks.push({ seasonType: w.seasonType, week: w.week, events: data.events ?? [] });
  }
  return weeks;
}

/** Every week of every season type for one calendar year -- used for the
 * once-a-year season rollover, not the regular 15-minute sync. */
export async function fetchFullSeasonWeeks(seasonYear: number): Promise<ScoreboardWeek[]> {
  const weeks: ScoreboardWeek[] = [];

  for (const seasonType of [1, 2, 3]) {
    const maxWeeks = getMaxWeeksForSeasonType(seasonType);
    for (let week = 1; week <= maxWeeks; week++) {
      const params = new URLSearchParams({
        seasontype: String(seasonType),
        week: String(week),
        dates: String(seasonYear),
      });
      const res = await fetch(`${ESPN_BASE}/scoreboard?${params}`);
      if (!res.ok) {
        throw new Error(`ESPN API error ${res.status} for season type ${seasonType} week ${week}`);
      }
      const data: ESPNEventPayload = await res.json();
      weeks.push({ seasonType, week, events: data.events ?? [] });
      // Be polite to ESPN's undocumented API.
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return weeks;
}
