CREATE TABLE `pending_email_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`new_email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
