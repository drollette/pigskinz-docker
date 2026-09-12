-- Picks summary table for weekly standings and tiebreakers
CREATE TABLE `picks_summary` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `week_number` integer NOT NULL,
  `season_type` integer NOT NULL,
  `tiebreaker_game_id` text,
  `tiebreaker_prediction` integer,
  `correct_picks_count` integer DEFAULT 0,
  `total_picks_count` integer DEFAULT 0,
  `tiebreaker_actual` integer,
  `tiebreaker_diff` integer,
  `rank` integer,
  `created_at` integer DEFAULT (unixepoch()),
  `updated_at` integer DEFAULT (unixepoch()),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Unique constraint: one summary per user per week
CREATE UNIQUE INDEX `picks_summary_user_week_idx` ON `picks_summary` (`user_id`, `week_number`, `season_type`);

-- Unique constraint: tiebreaker prediction must be unique per week (no two users can pick same number)
CREATE UNIQUE INDEX `picks_summary_tiebreaker_idx` ON `picks_summary` (`week_number`, `season_type`, `tiebreaker_prediction`) WHERE `tiebreaker_prediction` IS NOT NULL;
