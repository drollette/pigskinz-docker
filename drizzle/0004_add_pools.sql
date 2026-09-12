-- Migration: Add pools system for football pool management
-- This adds tables for pools, pool members, and pool invites

-- Pools table - stores pool information
CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_private INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 100,
  season_year INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Pool members table - links users to pools with roles
CREATE TABLE IF NOT EXISTS pool_members (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at INTEGER DEFAULT (unixepoch()),
  invited_by TEXT REFERENCES users(id),
  UNIQUE(pool_id, user_id)
);

-- Pool invites table - for tracking pending invitations
CREATE TABLE IF NOT EXISTS pool_invites (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pools_owner ON pools(owner_id);
CREATE INDEX IF NOT EXISTS idx_pools_invite_code ON pools(invite_code);
CREATE INDEX IF NOT EXISTS idx_pool_members_pool ON pool_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_members_user ON pool_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_invites_pool ON pool_invites(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_invites_email ON pool_invites(email);
