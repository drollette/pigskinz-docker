ALTER TABLE `site_settings` ADD COLUMN `prize_first_percent` integer;
--> statement-breakpoint
ALTER TABLE `site_settings` ADD COLUMN `prize_second_percent` integer;
--> statement-breakpoint
ALTER TABLE `site_settings` ADD COLUMN `prize_third_percent` integer;
--> statement-breakpoint
ALTER TABLE `site_settings` ADD COLUMN `prize_bar_enabled` integer;
--> statement-breakpoint
-- Seeds the existing singleton row with the 60/30/10/shown defaults this
-- app ships with (see DEFAULT_PRIZE_SPLIT in prize-pool.ts), so this
-- migration is a pure behavior no-op on deploy -- see the matching comment
-- in 0027_add_site_settings_buy_in.sql for why this backfill (rather than
-- leaving these null and relying on the in-code fallback) matters for an
-- already-live environment.
UPDATE `site_settings`
SET
	`prize_first_percent` = 60,
	`prize_second_percent` = 30,
	`prize_third_percent` = 10,
	`prize_bar_enabled` = true
WHERE `id` = 'singleton' AND `prize_first_percent` IS NULL;
