CREATE TABLE `account_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`flow_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`transaction_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_before_cents` integer NOT NULL,
	`balance_after_cents` integer NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_acc_tx_account_date` ON `account_transactions` (`account_id`,`transaction_date`);--> statement-breakpoint
CREATE TABLE `account_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_date` text NOT NULL,
	`from_account_id` text NOT NULL,
	`to_account_id` text NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text NOT NULL,
	`from_amount_cents` integer NOT NULL,
	`to_amount_cents` integer NOT NULL,
	`exchange_rate` real,
	`memo` text,
	`voucher_url` text,
	`created_by` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`alias` text,
	`account_number` text,
	`opening_cents` integer DEFAULT 0,
	`active` integer DEFAULT 1,
	`version` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `allowance_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`allowance_type` text NOT NULL,
	`currency_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_date` text NOT NULL,
	`payment_method` text DEFAULT 'cash',
	`voucher_url` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_unq_allowance_payments_emp_period_type` ON `allowance_payments` (`employee_id`,`year`,`month`,`allowance_type`);--> statement-breakpoint
CREATE TABLE `ar_ap_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`party_id` text,
	`site_id` text,
	`project_id` text,
	`issue_date` text,
	`due_date` text,
	`amount_cents` integer NOT NULL,
	`doc_no` text,
	`memo` text,
	`status` text DEFAULT 'open',
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`clock_in_time` integer,
	`clock_out_time` integer,
	`clock_in_location` text,
	`clock_out_location` text,
	`status` text,
	`memo` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text,
	`entity` text,
	`entity_id` text,
	`at` integer NOT NULL,
	`detail` text,
	`ip` text,
	`ip_location` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_time` ON `audit_logs` (`at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_entity` ON `audit_logs` (`entity_id`);--> statement-breakpoint
CREATE TABLE `business_operation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`operator_id` text,
	`operator_name` text,
	`before_data` text,
	`after_data` text,
	`memo` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_no` text,
	`biz_date` text NOT NULL,
	`type` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`method` text,
	`amount_cents` integer NOT NULL,
	`site_id` text,
	`project_id` text,
	`counterparty` text,
	`memo` text,
	`voucher_url` text,
	`created_by` text,
	`created_at` integer,
	`is_reversal` integer DEFAULT 0,
	`reversal_of_flow_id` text,
	`is_reversed` integer DEFAULT 0,
	`reversed_by_flow_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_cash_flows_account_biz` ON `cash_flows` (`account_id`,`biz_date`);--> statement-breakpoint
CREATE INDEX `idx_cash_flows_type` ON `cash_flows` (`type`);--> statement-breakpoint
CREATE INDEX `idx_cash_flows_reversal` ON `cash_flows` (`reversal_of_flow_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `currencies` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`symbol` text,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `dormitory_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`room_number` text,
	`bed_number` text,
	`allocation_date` text NOT NULL,
	`monthly_rent_cents` integer,
	`return_date` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `employee_allowances` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`allowance_type` text NOT NULL,
	`currency_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `employee_leaves` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` integer NOT NULL,
	`status` text DEFAULT 'pending',
	`reason` text,
	`memo` text,
	`approved_by` text,
	`approved_at` integer,
	`version` integer DEFAULT 1,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `employee_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`project_id` text NOT NULL,
	`role` text,
	`is_primary` integer DEFAULT 0,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_unq_ep_employee_project` ON `employee_projects` (`employee_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `idx_ep_employee` ON `employee_projects` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_ep_project` ON `employee_projects` (`project_id`);--> statement-breakpoint
CREATE TABLE `employee_salaries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`salary_type` text NOT NULL,
	`currency_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`effective_date` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`personal_email` text,
	`name` text,
	`position_id` text,
	`org_department_id` text,
	`project_id` text,
	`join_date` text,
	`status` text,
	`active` integer DEFAULT 1,
	`phone` text,
	`usdt_address` text,
	`emergency_contact` text,
	`emergency_phone` text,
	`address` text,
	`memo` text,
	`birthday` text,
	`regular_date` text,
	`work_schedule` text,
	`annual_leave_cycle_months` integer,
	`annual_leave_days` integer,
	`created_at` integer,
	`updated_at` integer,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE TABLE `expense_reimbursements` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`expense_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency_id` text DEFAULT 'CNY',
	`expense_date` text NOT NULL,
	`description` text NOT NULL,
	`voucher_url` text,
	`status` text DEFAULT 'pending',
	`approved_by` text,
	`approved_at` integer,
	`memo` text,
	`version` integer DEFAULT 1,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `fixed_asset_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`allocation_date` text NOT NULL,
	`allocation_type` text DEFAULT 'employee_onboarding',
	`return_date` text,
	`return_type` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `fixed_asset_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`change_type` text NOT NULL,
	`change_date` text NOT NULL,
	`from_dept_id` text,
	`to_dept_id` text,
	`from_site_id` text,
	`to_site_id` text,
	`from_custodian` text,
	`to_custodian` text,
	`from_status` text,
	`to_status` text,
	`memo` text,
	`created_by` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `fixed_asset_depreciations` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`depreciation_date` text NOT NULL,
	`depreciation_amount_cents` integer NOT NULL,
	`accumulated_depreciation_cents` integer NOT NULL,
	`remaining_value_cents` integer NOT NULL,
	`memo` text,
	`created_by` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_code` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`purchase_date` text,
	`purchase_price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`vendor_id` text,
	`project_id` text,
	`site_id` text,
	`custodian` text,
	`status` text DEFAULT 'in_use',
	`depreciation_method` text,
	`useful_life_years` integer,
	`current_value_cents` integer,
	`memo` text,
	`sale_date` text,
	`sale_price_cents` integer,
	`sale_buyer` text,
	`sale_memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixed_assets_asset_code_unique` ON `fixed_assets` (`asset_code`);--> statement-breakpoint
CREATE TABLE `headquarters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending',
	`completed_at` integer,
	`sort_order` integer DEFAULT 0,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_milestones_project` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE TABLE `opening_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`ref_id` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `org_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`parent_id` text,
	`name` text NOT NULL,
	`code` text,
	`description` text,
	`allowed_modules` text,
	`allowed_positions` text,
	`default_position_id` text,
	`active` integer DEFAULT 1,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `personal_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`is_all_day` integer DEFAULT 0,
	`color` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `pm_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_comment_id` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pm_comments_entity` ON `pm_comments` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`level` integer DEFAULT 3 NOT NULL,
	`function_role` text DEFAULT 'member' NOT NULL,
	`can_manage_subordinates` integer DEFAULT 0,
	`data_scope` text DEFAULT 'self' NOT NULL,
	`description` text,
	`permissions` text,
	`sort_order` integer DEFAULT 0,
	`active` integer DEFAULT 1,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_code_unique` ON `positions` (`code`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`hq_id` text,
	`project_id` text,
	`manager_id` text,
	`status` text DEFAULT 'active',
	`start_date` text,
	`end_date` text,
	`actual_start_date` text,
	`actual_end_date` text,
	`priority` text DEFAULT 'medium',
	`budget_cents` integer,
	`memo` text,
	`sort_order` integer DEFAULT 100,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_code_unique` ON `projects` (`code`);--> statement-breakpoint
CREATE TABLE `rental_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`change_type` text NOT NULL,
	`change_date` text NOT NULL,
	`from_lease_start` text,
	`to_lease_start` text,
	`from_lease_end` text,
	`to_lease_end` text,
	`from_monthly_rent_cents` integer,
	`to_monthly_rent_cents` integer,
	`from_status` text,
	`to_status` text,
	`memo` text,
	`created_by` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `rental_payable_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`bill_date` text NOT NULL,
	`due_date` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`payment_period_months` integer DEFAULT 1,
	`status` text DEFAULT 'unpaid',
	`paid_date` text,
	`paid_payment_id` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `rental_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`payment_method` text,
	`voucher_url` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `rental_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`property_code` text NOT NULL,
	`name` text NOT NULL,
	`property_type` text NOT NULL,
	`address` text,
	`area_sqm` real,
	`rent_type` text DEFAULT 'monthly',
	`monthly_rent_cents` integer,
	`yearly_rent_cents` integer,
	`currency` text NOT NULL,
	`payment_period_months` integer DEFAULT 1,
	`landlord_name` text,
	`landlord_contact` text,
	`lease_start_date` text,
	`lease_end_date` text,
	`deposit_cents` integer,
	`payment_method` text,
	`payment_account_id` text,
	`payment_day` integer DEFAULT 1,
	`project_id` text,
	`status` text DEFAULT 'active',
	`memo` text,
	`contract_file_url` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'draft',
	`estimated_hours` integer,
	`actual_hours` integer,
	`deadline` text,
	`assignee_ids` text,
	`reviewer_ids` text,
	`reviewed_at` integer,
	`review_memo` text,
	`attachment_urls` text,
	`version` integer DEFAULT 1,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requirements_code_unique` ON `requirements` (`code`);--> statement-breakpoint
CREATE INDEX `idx_requirements_project` ON `requirements` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_requirements_status` ON `requirements` (`status`);--> statement-breakpoint
CREATE TABLE `salary_payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`salary_payment_id` text NOT NULL,
	`currency_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`account_id` text,
	`status` text DEFAULT 'pending',
	`requested_by` text,
	`requested_at` integer,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `salary_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`salary_cents` integer NOT NULL,
	`status` text NOT NULL,
	`allocation_status` text DEFAULT 'pending',
	`employee_confirmed_by` text,
	`employee_confirmed_at` integer,
	`finance_approved_by` text,
	`finance_approved_at` integer,
	`account_id` text,
	`payment_transferred_by` text,
	`payment_transferred_at` integer,
	`payment_voucher_path` text,
	`payment_confirmed_by` text,
	`payment_confirmed_at` integer,
	`rollback_reason` text,
	`rollback_by` text,
	`rollback_at` integer,
	`version` integer DEFAULT 1,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_unq_salary_payments_emp_period` ON `salary_payments` (`employee_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer,
	`last_active_at` integer
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`doc_id` text NOT NULL,
	`flow_id` text NOT NULL,
	`settle_amount_cents` integer NOT NULL,
	`settle_date` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `site_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`bill_date` text NOT NULL,
	`bill_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`description` text,
	`account_id` text,
	`category_id` text,
	`status` text DEFAULT 'pending',
	`payment_date` text,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`site_code` text,
	`active` integer DEFAULT 1,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_timelogs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`project_id` text,
	`employee_id` text NOT NULL,
	`log_date` text NOT NULL,
	`hours` real NOT NULL,
	`description` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_timelogs_task` ON `task_timelogs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_timelogs_project` ON `task_timelogs` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_timelogs_employee_date` ON `task_timelogs` (`employee_id`,`log_date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`requirement_id` text,
	`project_id` text NOT NULL,
	`parent_task_id` text,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'dev',
	`priority` text DEFAULT 'medium',
	`status` text DEFAULT 'todo',
	`estimated_hours` integer,
	`actual_hours` integer,
	`start_date` text,
	`due_date` text,
	`completed_at` integer,
	`assignee_ids` text,
	`reviewer_ids` text,
	`tester_ids` text,
	`sort_order` integer DEFAULT 0,
	`version` integer DEFAULT 1,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_code_unique` ON `tasks` (`code`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_requirement` ON `tasks` (`requirement_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`phone` text,
	`email` text,
	`address` text,
	`memo` text,
	`active` integer DEFAULT 1,
	`created_at` integer,
	`updated_at` integer
);
