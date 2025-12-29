-- Migration: Update requirements to multi-assignee
-- Date: 2025-12-29
-- Description: Replace assignee_id/reviewer_id with assignee_ids/reviewer_ids JSON arrays

-- 1. Add new columns
ALTER TABLE requirements ADD COLUMN assignee_ids TEXT;
ALTER TABLE requirements ADD COLUMN reviewer_ids TEXT;

-- 2. Migrate existing data (encapsulate single ID in JSON array)
-- SQLite string functions to match: '[ "' || assignee_id || '" ]'
UPDATE requirements SET assignee_ids = '["' || assignee_id || '"]' WHERE assignee_id IS NOT NULL;
UPDATE requirements SET reviewer_ids = '["' || reviewer_id || '"]' WHERE reviewer_id IS NOT NULL;

-- 3. Drop old index first
DROP INDEX IF EXISTS idx_requirements_assignee;

-- 4. Drop old columns
ALTER TABLE requirements DROP COLUMN assignee_id;
ALTER TABLE requirements DROP COLUMN reviewer_id;
