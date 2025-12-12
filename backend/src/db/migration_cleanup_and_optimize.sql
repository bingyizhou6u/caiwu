
-- Deep Optimization and Cleanup Migration
-- Created: 2025-12-13

-- 1. DROP redundant 'id_card' column from employees
-- Note: D1 supports DROP COLUMN
-- If the column doesn't exist (due to previous sync issues), this might fail, so we wrap? No, SQLite doesn't have IF EXISTS for DROP COLUMN easily.
-- But we know it exists from PRAGMA check.
ALTER TABLE employees DROP COLUMN id_card;

-- 2. FIX exchange_rate type in account_transfers (INTEGER -> REAL)
-- Step 2.1: Add new column
ALTER TABLE account_transfers ADD COLUMN exchange_rate_new REAL;

-- Step 2.2: Migrate data
UPDATE account_transfers SET exchange_rate_new = exchange_rate;

-- Step 2.3: Drop old column
ALTER TABLE account_transfers DROP COLUMN exchange_rate;

-- Step 2.4: Rename new column
ALTER TABLE account_transfers RENAME COLUMN exchange_rate_new TO exchange_rate;

-- 3. ADD Unique Constraints for Data Integrity

-- Prevent duplicate salary payments for same employee in same month
CREATE UNIQUE INDEX IF NOT EXISTS idx_unq_salary_payments_emp_period 
ON salary_payments(employee_id, year, month);

-- Prevent duplicate allowance payments (same type) for same employee in same month
CREATE UNIQUE INDEX IF NOT EXISTS idx_unq_allowance_payments_emp_period_type 
ON allowance_payments(employee_id, year, month, allowance_type);

-- Ensure asset codes are unique (if not already enforced by PK or existing index)
-- asset_code is defined as unique in schema, usually implies an index exists.
-- But explicit index ensures it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unq_fixed_assets_code 
ON fixed_assets(asset_code);
