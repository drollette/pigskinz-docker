// Static NFL conference/division alignment, keyed by ESPN team abbreviation
// (the same abbreviations already stored on `teams.abbreviation`). This is
// reference data, not something that needs syncing — division realignment
// is rare enough (last happened in 2002) that hardcoding it is simpler and
// more reliable than depending on another ESPN endpoint for it.

export type Conference = "AFC" | "NFC";
export type Division = "East" | "North" | "South" | "West";

export interface TeamDivision {
  conference: Conference;
  division: Division;
}

export const TEAM_DIVISIONS: Record<string, TeamDivision> = {
  // AFC East
  BUF: { conference: "AFC", division: "East" },
  MIA: { conference: "AFC", division: "East" },
  NE: { conference: "AFC", division: "East" },
  NYJ: { conference: "AFC", division: "East" },
  // AFC North
  BAL: { conference: "AFC", division: "North" },
  CIN: { conference: "AFC", division: "North" },
  CLE: { conference: "AFC", division: "North" },
  PIT: { conference: "AFC", division: "North" },
  // AFC South
  HOU: { conference: "AFC", division: "South" },
  IND: { conference: "AFC", division: "South" },
  JAX: { conference: "AFC", division: "South" },
  TEN: { conference: "AFC", division: "South" },
  // AFC West
  DEN: { conference: "AFC", division: "West" },
  KC: { conference: "AFC", division: "West" },
  LAC: { conference: "AFC", division: "West" },
  LV: { conference: "AFC", division: "West" },
  // NFC East
  DAL: { conference: "NFC", division: "East" },
  NYG: { conference: "NFC", division: "East" },
  PHI: { conference: "NFC", division: "East" },
  WSH: { conference: "NFC", division: "East" },
  // NFC North
  CHI: { conference: "NFC", division: "North" },
  DET: { conference: "NFC", division: "North" },
  GB: { conference: "NFC", division: "North" },
  MIN: { conference: "NFC", division: "North" },
  // NFC South
  ATL: { conference: "NFC", division: "South" },
  CAR: { conference: "NFC", division: "South" },
  NO: { conference: "NFC", division: "South" },
  TB: { conference: "NFC", division: "South" },
  // NFC West
  ARI: { conference: "NFC", division: "West" },
  LAR: { conference: "NFC", division: "West" },
  SEA: { conference: "NFC", division: "West" },
  SF: { conference: "NFC", division: "West" },
};

export const CONFERENCES: Conference[] = ["AFC", "NFC"];
export const DIVISIONS: Division[] = ["East", "North", "South", "West"];
