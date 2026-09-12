-- Remove foreign key constraints from picks table
-- SQLite requires table recreation to remove foreign keys

-- Create new table without foreign key constraints on gameId and teamId
CREATE TABLE `picks_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`team_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`season_type` integer NOT NULL,
	`is_correct` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Copy existing data
INSERT INTO `picks_new` SELECT * FROM `picks`;
--> statement-breakpoint
-- Drop old table
DROP TABLE `picks`;
--> statement-breakpoint
-- Rename new table
ALTER TABLE `picks_new` RENAME TO `picks`;
