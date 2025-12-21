ALTER TABLE `cash_flows` ADD `is_reversal` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cash_flows` ADD `reversal_of_flow_id` text;--> statement-breakpoint
ALTER TABLE `cash_flows` ADD `is_reversed` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `cash_flows` ADD `reversed_by_flow_id` text;--> statement-breakpoint
CREATE INDEX `idx_cash_flows_reversal` ON `cash_flows` (`reversal_of_flow_id`);--> statement-breakpoint
ALTER TABLE `departments` ADD `sort_order` integer DEFAULT 100;