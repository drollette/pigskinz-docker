ALTER TABLE `picks_summary` ADD COLUMN `tiebreaker_submitted_at` integer;
--> statement-breakpoint
ALTER TABLE `archived_picks_summary` ADD COLUMN `tiebreaker_submitted_at` integer;
