CREATE TABLE `archived_games` (
	`id` text PRIMARY KEY NOT NULL,
	`original_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`date` integer NOT NULL,
	`season_type` integer NOT NULL,
	`week_number` integer NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`home_team_score` integer,
	`away_team_score` integer,
	`completed` integer DEFAULT false,
	`status_name` text DEFAULT 'STATUS_SCHEDULED',
	`odds` text,
	`over_under` real,
	`created_at` integer,
	`updated_at` integer,
	`season_year` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `archived_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`original_id` text NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`team_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`season_type` integer NOT NULL,
	`is_correct` integer,
	`created_at` integer,
	`updated_at` integer,
	`season_year` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `archived_picks_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`original_id` text NOT NULL,
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
	`created_at` integer,
	`updated_at` integer,
	`season_year` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
