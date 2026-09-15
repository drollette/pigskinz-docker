ALTER TABLE `site_settings` ADD COLUMN `week_results_email_subject` text;
--> statement-breakpoint
ALTER TABLE `site_settings` ADD COLUMN `week_results_email_body` text;
--> statement-breakpoint
CREATE TABLE `week_results_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`season_type` integer NOT NULL,
	`week_number` integer NOT NULL,
	`sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `week_results_emails_season_week_idx` ON `week_results_emails` (`season_type`, `week_number`);
--> statement-breakpoint
-- Backfills every week that's already fully graded (picks_summary.rank is
-- only ever non-null once updateWeeklyStandings sees every game in that
-- week complete -- see game-sync-core.ts) as "already sent" the moment
-- this feature is deployed, so the new automatic sender doesn't turn
-- around and retroactively email results for weeks an admin already
-- covered by hand (e.g. this season's Week 1, sent manually before this
-- migration ran).
INSERT INTO `week_results_emails` (`id`, `season_type`, `week_number`, `sent_at`)
SELECT lower(hex(randomblob(16))), `season_type`, `week_number`, unixepoch()
FROM `picks_summary`
WHERE `rank` IS NOT NULL
GROUP BY `season_type`, `week_number`;
--> statement-breakpoint
-- Seeds a working default template (wording matches what this pool's admin
-- was already sending by hand) so the feature is live immediately rather
-- than silently doing nothing until someone visits the admin dashboard.
-- ON CONFLICT DO UPDATE rather than a plain INSERT since site_settings is a
-- singleton row that already exists in every real environment (it's had a
-- home_message column since long before this migration).
INSERT INTO `site_settings` (`id`, `week_results_email_subject`, `week_results_email_body`, `updated_at`)
VALUES (
	'singleton',
	'{week_results_week} Results',
	'<p>{week_results_week} Results:</p><p>1st Place - {week_results_first_place}</p><p>2nd Place - {week_results_second_place}</p><p>3rd Place - {week_results_third_place}</p><p>Closest tiebreaker - {week_results_tiebreaker_winners}</p><p>Make your picks or set your Auto Pick before {next_game_week} Game 1: {next_game}, {next_game_start_time}</p><p>Good luck!</p>',
	unixepoch()
)
ON CONFLICT(`id`) DO UPDATE SET
	`week_results_email_subject` = excluded.`week_results_email_subject`,
	`week_results_email_body` = excluded.`week_results_email_body`,
	`updated_at` = excluded.`updated_at`;
