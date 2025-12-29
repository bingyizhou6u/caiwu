-- 项目管理模块迁移
-- Migration: Add PM (Project Management) module tables
-- Date: 2025-12-27

-- 项目表
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`department_id` text NOT NULL,
	`manager_id` text,
	`status` text DEFAULT 'active',
	`start_date` text,
	`end_date` text,
	`actual_start_date` text,
	`actual_end_date` text,
	`priority` text DEFAULT 'medium',
	`budget_cents` integer,
	`memo` text,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_code_unique` ON `projects` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_projects_department` ON `projects` (`department_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_projects_status` ON `projects` (`status`);
--> statement-breakpoint

-- 需求表
CREATE TABLE IF NOT EXISTS `requirements` (
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
	`assignee_id` text,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_memo` text,
	`attachment_urls` text,
	`version` integer DEFAULT 1,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `requirements_code_unique` ON `requirements` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requirements_project` ON `requirements` (`project_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requirements_status` ON `requirements` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_requirements_assignee` ON `requirements` (`assignee_id`);
--> statement-breakpoint

-- 任务表
CREATE TABLE IF NOT EXISTS `tasks` (
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
	`assignee_id` text,
	`sort_order` integer DEFAULT 0,
	`version` integer DEFAULT 1,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tasks_code_unique` ON `tasks` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tasks_project` ON `tasks` (`project_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tasks_requirement` ON `tasks` (`requirement_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tasks_status` ON `tasks` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tasks_assignee` ON `tasks` (`assignee_id`);
--> statement-breakpoint

-- 工时记录表
CREATE TABLE IF NOT EXISTS `task_timelogs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`log_date` text NOT NULL,
	`hours` real NOT NULL,
	`description` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_timelogs_task` ON `task_timelogs` (`task_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_timelogs_employee_date` ON `task_timelogs` (`employee_id`, `log_date`);
--> statement-breakpoint

-- 里程碑表
CREATE TABLE IF NOT EXISTS `milestones` (
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
CREATE INDEX IF NOT EXISTS `idx_milestones_project` ON `milestones` (`project_id`);
--> statement-breakpoint

-- 需求/任务评论表
CREATE TABLE IF NOT EXISTS `pm_comments` (
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
CREATE INDEX IF NOT EXISTS `idx_pm_comments_entity` ON `pm_comments` (`entity_type`, `entity_id`);
