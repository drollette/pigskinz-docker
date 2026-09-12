#!/usr/bin/env node
// Seeds the local SQLite database with dummy users, picks, and tiebreaker
// summaries against whatever games are already loaded (run scripts/migrate.mjs
// and sync games in first). Every identity here is fake/@example.com --
// useful for exercising standings/leaderboard logic without real user data.
//
// Run with: npm run db:seed

import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH ?? "./data/pigskinz.db";
const db = new Database(dbPath);

const users = [
  { id: "seed-user-1", email: "john.doe@example.com", name: "John Doe", username: "johndoe", homeTeamBias: 0.6 },
  { id: "seed-user-2", email: "jane.smith@example.com", name: "Jane Smith", username: "janesmith", homeTeamBias: 0.4 },
  { id: "seed-user-3", email: "bob.wilson@example.com", name: "Bob Wilson", username: "bobwilson", homeTeamBias: 0.5 },
  { id: "seed-user-4", email: "alice.jones@example.com", name: "Alice Jones", username: "alicejones", homeTeamBias: 0.7 },
  { id: "seed-user-5", email: "charlie.brown@example.com", name: "Charlie Brown", username: "charlieb", homeTeamBias: 0.3 },
];

// Dummy password hash for 'password123' -- fine for local dev only.
const passwordHash = "$2a$10$rQZ8K.XKvHvVkKQF.5VZxOqhPvHqE3C5X5.ZqNvP0WqKK5XQpP5Hy";

const tiebreakerRanges = [
  { base: 42, variance: 7 },
  { base: 35, variance: 7 },
  { base: 49, variance: 7 },
  { base: 28, variance: 7 },
  { base: 56, variance: 7 },
];

let sql = "";

sql += `-- Create dummy users\n`;
for (const user of users) {
  sql += `INSERT OR IGNORE INTO users (id, email, email_verified, name, username, password_hash, is_admin, created_at, updated_at)
VALUES ('${user.id}', '${user.email}', 1, '${user.name}', '${user.username}', '${passwordHash}', 0, unixepoch(), unixepoch());\n`;
}

sql += `\n-- Create picks for all games (each user picks with varying patterns per week)\n`;

for (let i = 0; i < users.length; i++) {
  const user = users[i];
  const baseBias = Math.floor(user.homeTeamBias * 100);
  const styleModifier = [17, 23, 31, 41, 53][i];
  const userSeed = [7919, 6373, 4931, 3571, 2239][i];

  sql += `
INSERT OR IGNORE INTO picks (id, user_id, game_id, team_id, week_number, season_type, is_correct, created_at, updated_at)
SELECT
  '${user.id}-' || g.id,
  '${user.id}',
  g.id,
  CASE
    WHEN (
      (abs(CAST(substr(g.id, -6) AS INTEGER)) * ${styleModifier} + g.week_number * 137 + g.season_type * 1009 + ${userSeed})
      % 100
    ) < (${baseBias} + ((g.week_number * ${styleModifier}) % 31) - 15) THEN g.home_team_id
    ELSE g.away_team_id
  END,
  g.week_number,
  g.season_type,
  CASE
    WHEN g.completed = 0 OR g.home_team_score IS NULL OR g.away_team_score IS NULL THEN NULL
    WHEN g.home_team_score = g.away_team_score THEN NULL
    WHEN g.home_team_score > g.away_team_score THEN
      CASE WHEN (
        (abs(CAST(substr(g.id, -6) AS INTEGER)) * ${styleModifier} + g.week_number * 137 + g.season_type * 1009 + ${userSeed})
        % 100
      ) < (${baseBias} + ((g.week_number * ${styleModifier}) % 31) - 15) THEN 1 ELSE 0 END
    ELSE
      CASE WHEN (
        (abs(CAST(substr(g.id, -6) AS INTEGER)) * ${styleModifier} + g.week_number * 137 + g.season_type * 1009 + ${userSeed})
        % 100
      ) >= (${baseBias} + ((g.week_number * ${styleModifier}) % 31) - 15) THEN 1 ELSE 0 END
  END,
  unixepoch(),
  unixepoch()
FROM games g
WHERE NOT EXISTS (SELECT 1 FROM picks WHERE picks.id = '${user.id}-' || g.id);
`;
}

sql += `\n-- Create picks_summary with tiebreaker predictions\n`;

for (let i = 0; i < users.length; i++) {
  const user = users[i];
  const tb = tiebreakerRanges[i];

  sql += `
INSERT OR IGNORE INTO picks_summary (id, user_id, week_number, season_type, tiebreaker_game_id, tiebreaker_prediction, correct_picks_count, total_picks_count, tiebreaker_actual, tiebreaker_diff, created_at, updated_at)
SELECT
  '${user.id}-summary-' || week_number || '-' || season_type,
  '${user.id}',
  week_number,
  season_type,
  tiebreaker_game_id,
  ${tb.base} + (week_number % ${tb.variance}),
  correct_count,
  total_count,
  CASE WHEN tb_completed = 1 THEN tb_total ELSE NULL END,
  CASE WHEN tb_completed = 1 THEN abs((${tb.base} + (week_number % ${tb.variance})) - tb_total) ELSE NULL END,
  unixepoch(),
  unixepoch()
FROM (
  SELECT
    p.week_number,
    p.season_type,
    tb.id as tiebreaker_game_id,
    tb.completed as tb_completed,
    COALESCE(tb.home_team_score, 0) + COALESCE(tb.away_team_score, 0) as tb_total,
    SUM(CASE WHEN p.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
    COUNT(*) as total_count
  FROM picks p
  LEFT JOIN (
    SELECT g1.*, g1.week_number as wn, g1.season_type as st
    FROM games g1
    WHERE g1.date = (
      SELECT MAX(g2.date) FROM games g2
      WHERE g2.week_number = g1.week_number AND g2.season_type = g1.season_type
    )
  ) tb ON tb.wn = p.week_number AND tb.st = p.season_type
  WHERE p.user_id = '${user.id}'
  GROUP BY p.week_number, p.season_type, tb.id, tb.completed, tb_total
) subq
WHERE NOT EXISTS (
  SELECT 1 FROM picks_summary
  WHERE picks_summary.id = '${user.id}-summary-' || week_number || '-' || season_type
);
`;
}

sql += `
UPDATE picks_summary
SET rank = (
  SELECT COUNT(*) + 1
  FROM picks_summary ps2
  WHERE ps2.week_number = picks_summary.week_number
  AND ps2.season_type = picks_summary.season_type
  AND (
    ps2.correct_picks_count > picks_summary.correct_picks_count
    OR (
      ps2.correct_picks_count = picks_summary.correct_picks_count
      AND COALESCE(ps2.tiebreaker_diff, 999) < COALESCE(picks_summary.tiebreaker_diff, 999)
    )
  )
)
WHERE picks_summary.user_id LIKE 'seed-user-%';
`;

db.exec(sql);

const userCount = db.prepare("SELECT COUNT(DISTINCT id) AS n FROM users WHERE id LIKE 'seed-user-%'").get().n;
const pickCount = db.prepare("SELECT COUNT(*) AS n FROM picks WHERE user_id LIKE 'seed-user-%'").get().n;
const summaryCount = db.prepare("SELECT COUNT(*) AS n FROM picks_summary WHERE user_id LIKE 'seed-user-%'").get().n;

console.log(`Seeded users: ${userCount}`);
console.log(`Seeded picks: ${pickCount}`);
console.log(`Seeded summaries: ${summaryCount}`);

db.close();
