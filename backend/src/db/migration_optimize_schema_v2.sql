
-- Performance Optimization Migration
-- Created: 2025-12-13
-- Purpose: Add missing indices for foreign keys and clean up backup tables

-- 1. Add missing indexes for employees table (critical for filtering)
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_department_id ON employees(org_department_id);

-- 2. Add missing indexes for org_departments (critical for hierarchy)
CREATE INDEX IF NOT EXISTS idx_org_departments_project_id ON org_departments(project_id);
CREATE INDEX IF NOT EXISTS idx_org_departments_parent_id ON org_departments(parent_id);

-- 3. Add missing index for usage mapping
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);

-- 4. Add missing indexes for account transfers history
CREATE INDEX IF NOT EXISTS idx_account_transfers_from_account ON account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to_account ON account_transfers(to_account_id);

-- 5. Cleanup redundant backup tables
DROP TABLE IF EXISTS positions_backup;
DROP TABLE IF EXISTS positions_backup_20251130;
DROP TABLE IF EXISTS employees_backup_20251130;
DROP TABLE IF EXISTS users_backup_name_removal;
