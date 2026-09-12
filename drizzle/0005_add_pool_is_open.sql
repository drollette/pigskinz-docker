-- Migration: Add is_open field to pools for controlling signups
-- When is_open is 0 (false), new members cannot join the pool

ALTER TABLE pools ADD COLUMN is_open INTEGER DEFAULT 1;

-- Create index for filtering open pools
CREATE INDEX IF NOT EXISTS idx_pools_is_open ON pools(is_open);
