-- Cleanup Obsolete Columns and Tables
-- Created: 2025-12-01
-- Description: Remove 'scope' from positions, 'job_role' from employees, and drop backup tables.

-- 1. Remove 'scope' from positions
-- SQLite supports DROP COLUMN in recent versions. If this fails, it means the D1 version is old, 
-- but we assume standard support.
ALTER TABLE positions DROP COLUMN scope;

-- 2. Remove 'job_role' from employees
ALTER TABLE employees DROP COLUMN job_role;

-- 3. Drop backup tables if they exist
DROP TABLE IF EXISTS positions_backup;
DROP TABLE IF EXISTS employees_backup;
DROP TABLE IF EXISTS positions_backup_20251130;
DROP TABLE IF EXISTS employees_backup_20251130;

-- 4. Verify schema (optional, for manual check)
-- PRAGMA table_info(positions);
-- PRAGMA table_info(employees);
