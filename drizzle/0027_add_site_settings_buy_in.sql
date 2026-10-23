ALTER TABLE `site_settings` ADD COLUMN `buy_in_dollars` integer;
--> statement-breakpoint
-- Seeds the existing singleton row with the $20 default this app ships
-- with (see DEFAULT_BUY_IN_DOLLARS in prize-pool.ts), so this migration is
-- a pure behavior no-op on deploy -- the admin-configurable value starts
-- out equal to the fallback already in code, rather than reverting every
-- already-live environment to a null state until an admin visits the
-- dashboard. A fresh environment with no singleton row yet has nothing for
-- this UPDATE to match, and correctly falls back to DEFAULT_BUY_IN_DOLLARS
-- in code until one is created.
UPDATE `site_settings` SET `buy_in_dollars` = 20 WHERE `id` = 'singleton' AND `buy_in_dollars` IS NULL;
