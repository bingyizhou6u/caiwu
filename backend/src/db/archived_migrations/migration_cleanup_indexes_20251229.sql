-- Migration: Cleanup legacy department indexes
-- Date: 2025-12-29
-- Description: Drop redundant idx_..._department indexes that are duplicates of idx_..._project

DROP INDEX IF EXISTS idx_requirements_department;
DROP INDEX IF EXISTS idx_tasks_department;
DROP INDEX IF EXISTS idx_timelogs_department;
DROP INDEX IF EXISTS idx_milestones_department;

-- Ensure correct project indexes exist (already defined in schema, but good to be safe)
-- formatting: off
CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_timelogs_project ON task_timelogs (project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones (project_id);
