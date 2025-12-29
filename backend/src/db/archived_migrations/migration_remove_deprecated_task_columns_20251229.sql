-- Migration: Drop deprecated task role columns
-- Date: 2025-12-29
-- Description: Remove assignee_id, reviewer_id, tester_id columns as they are replaced by JSON arrays

-- Drop dependent index first
DROP INDEX IF EXISTS idx_tasks_assignee;
DROP INDEX IF EXISTS idx_tasks_reviewer;
DROP INDEX IF EXISTS idx_tasks_tester;

-- SQLite supports DROP COLUMN in D1
ALTER TABLE tasks DROP COLUMN assignee_id;
ALTER TABLE tasks DROP COLUMN reviewer_id;
ALTER TABLE tasks DROP COLUMN tester_id;
