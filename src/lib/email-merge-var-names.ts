// Split out from email-merge-vars.ts so client components (the "Available
// variables" reference shown in AdminEmailForm/EmailTemplateManager) can
// import just this list without pulling in the server-only data-fetching
// code (database queries, etc.) that file also imports.
export const MERGE_VARIABLE_NAMES = [
  "name",
  "username",
  "next_game",
  "next_game_start_time",
  "next_game_week",
  "picks_url",
  "user_current_week_rank",
  "user_overall_rank",
  "user_points",
  "user_correct_picks",
  "user_total_picks",
  "user_win_rate",
  "total_players",
  "site_url",
  "current_week_tiebreaker_game",
  "current_week_tiebreaker_game_start_time",
  "current_week_tiebreaker_week",
  "current_week_tiebreaker_url",
  "user_tiebreaker_prediction",
] as const;

export type MergeVariableName = (typeof MERGE_VARIABLE_NAMES)[number];
