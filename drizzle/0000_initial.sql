-- Initial migration for Pigskinz database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar TEXT,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_display_name TEXT,
  color TEXT,
  alternate_color TEXT,
  logo TEXT
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  date INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  home_team_score INTEGER,
  away_team_score INTEGER,
  completed INTEGER DEFAULT 0,
  status_name TEXT DEFAULT 'STATUS_SCHEDULED',
  odds TEXT,
  over_under REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Picks table
CREATE TABLE IF NOT EXISTS picks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id),
  week_number INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  is_correct INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_games_week ON games(season_type, week_number);
CREATE INDEX IF NOT EXISTS idx_picks_user ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
