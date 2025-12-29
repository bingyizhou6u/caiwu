DROP TABLE `borrowers`;--> statement-breakpoint
DROP TABLE `borrowings`;--> statement-breakpoint
DROP TABLE `repayments`;--> statement-breakpoint
ALTER TABLE `positions` ADD `data_scope` text DEFAULT 'self' NOT NULL;--> statement-breakpoint

-- Migration: Map level to data_scope
UPDATE `positions` SET `data_scope` = 'all' WHERE `level` = 1;--> statement-breakpoint
UPDATE `positions` SET `data_scope` = 'project' WHERE `level` = 2;--> statement-breakpoint
UPDATE `positions` SET `data_scope` = 'group' WHERE `level` = 3;