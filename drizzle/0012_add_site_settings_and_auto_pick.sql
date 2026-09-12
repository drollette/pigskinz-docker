CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`home_message` text,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `picks` ADD COLUMN `is_auto_pick` integer DEFAULT false;
