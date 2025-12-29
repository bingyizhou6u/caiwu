-- Migration: Rename department_id to project_id across all tables
-- Step 1: Drop all indexes that reference department_id

DROP INDEX IF EXISTS idx_sites_dept;
DROP INDEX IF EXISTS idx_cash_flows_dept;
DROP INDEX IF EXISTS idx_ar_ap_dept;
DROP INDEX IF EXISTS idx_rental_properties_dept;
DROP INDEX IF EXISTS idx_cash_flows_biz_date_dept;
DROP INDEX IF EXISTS idx_cash_flows_dept_date;
DROP INDEX IF EXISTS idx_sites_department_id;
DROP INDEX IF EXISTS idx_fixed_assets_department_id;
DROP INDEX IF EXISTS idx_rental_properties_department_id;
DROP INDEX IF EXISTS idx_cash_flows_department_id;
DROP INDEX IF EXISTS idx_ar_ap_docs_department_id;
DROP INDEX IF EXISTS idx_employees_department_id;
DROP INDEX IF EXISTS idx_cash_flows_department_date;
DROP INDEX IF EXISTS idx_tasks_department;
DROP INDEX IF EXISTS idx_requirements_department;
DROP INDEX IF EXISTS idx_timelogs_department;
DROP INDEX IF EXISTS idx_milestones_department;

-- Step 2: Rename columns in core tables
ALTER TABLE sites RENAME COLUMN department_id TO project_id;
ALTER TABLE cash_flows RENAME COLUMN department_id TO project_id;
ALTER TABLE employees RENAME COLUMN department_id TO project_id;
ALTER TABLE fixed_assets RENAME COLUMN department_id TO project_id;
ALTER TABLE rental_properties RENAME COLUMN department_id TO project_id;
ALTER TABLE ar_ap_docs RENAME COLUMN department_id TO project_id;
ALTER TABLE user_departments RENAME COLUMN department_id TO project_id;

-- Step 3: Drop deprecated department_id from PM tables (they already have project_id)
ALTER TABLE requirements DROP COLUMN department_id;
ALTER TABLE tasks DROP COLUMN department_id;
ALTER TABLE task_timelogs DROP COLUMN department_id;
ALTER TABLE milestones DROP COLUMN department_id;

-- Step 4: Recreate indexes with new column name
CREATE INDEX idx_sites_project_id ON sites(project_id);
CREATE INDEX idx_cash_flows_project_id ON cash_flows(project_id);
CREATE INDEX idx_employees_project_id ON employees(project_id);
CREATE INDEX idx_fixed_assets_project_id ON fixed_assets(project_id);
CREATE INDEX idx_rental_properties_project_id ON rental_properties(project_id);
CREATE INDEX idx_ar_ap_docs_project_id ON ar_ap_docs(project_id);
CREATE INDEX idx_cash_flows_biz_date_project ON cash_flows(biz_date, project_id);
