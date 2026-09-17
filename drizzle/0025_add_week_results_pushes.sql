CREATE TABLE `week_results_pushes` (
	`id` text PRIMARY KEY NOT NULL,
	`season_type` integer NOT NULL,
	`week_number` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `week_results_pushes_season_week_idx` ON `week_results_pushes` (`season_type`, `week_number`);
--> statement-breakpoint
-- Same backfill reasoning as 0022_add_week_results_email.sql's insert into
-- week_results_emails: marks every already-graded week as "already sent" as
-- of this migration, so the new push sender doesn't turn around and blast
-- push notifications for weeks that finished long before this feature
-- existed.
INSERT INTO `week_results_pushes` (`id`, `season_type`, `week_number`, `sent_at`)
SELECT lower(hex(randomblob(16))), `season_type`, `week_number`, unixepoch()
FROM `picks_summary`
WHERE `rank` IS NOT NULL
GROUP BY `season_type`, `week_number`;
