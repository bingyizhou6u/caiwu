-- 修复 employees 表
PRAGMA foreign_keys=OFF;

-- 删除损坏的 employees 表
DROP TABLE IF EXISTS employees;

-- 从备份恢复（排除job_role字段）
CREATE TABLE employees AS 
SELECT 
  id, name, department_id, join_date, probation_salary_cents, regular_salary_cents,
  status, regular_date, active, created_at, updated_at, phone, email, id_card,
  bank_name, bank_account, emergency_contact, emergency_phone, address, memo,
  usdt_address, living_allowance_cents, housing_allowance_cents, 
  transportation_allowance_cents, meal_allowance_cents, org_department_id,
  birthday, position_id, work_schedule, annual_leave_cycle_months, annual_leave_days
FROM employees_backup_20251130;

-- 重建索引
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_org_department_id ON employees(org_department_id);
CREATE INDEX idx_employees_active ON employees(active);
CREATE UNIQUE INDEX idx_employees_email ON employees(email);

PRAGMA foreign_keys=ON;

