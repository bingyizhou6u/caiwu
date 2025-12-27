-- Migration: Add data_scope column to positions table
-- This column determines data visibility scope: all, project, group, self

ALTER TABLE positions ADD COLUMN data_scope TEXT DEFAULT 'self';

-- Set total manager (hq_manager) to have 'all' scope
UPDATE positions SET data_scope = 'all' WHERE code = 'hq_manager';

-- Set project managers to have 'project' scope
UPDATE positions SET data_scope = 'project' WHERE code LIKE '%project_manager%';

-- Set group managers to have 'group' scope  
UPDATE positions SET data_scope = 'group' WHERE code LIKE '%group_manager%';
