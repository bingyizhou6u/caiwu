-- Migration: Add notifications table for notification center
-- Date: 2025-12-29

CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`link` text,
	`related_entity_type` text,
	`related_entity_id` text,
	`is_read` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`read_at` integer
);

CREATE INDEX IF NOT EXISTS `idx_notifications_recipient` ON `notifications` (`recipient_id`);
CREATE INDEX IF NOT EXISTS `idx_notifications_recipient_read` ON `notifications` (`recipient_id`,`is_read`);
CREATE INDEX IF NOT EXISTS `idx_notifications_created_at` ON `notifications` (`created_at`);
