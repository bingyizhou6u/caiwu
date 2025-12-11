-- ==================== 删除冗余字段迁移脚本 ====================
-- 创建时间: 2025-12-08
-- 说明：从 employees 表中删除冗余的薪资/津贴字段
-- ⚠️ SQLite 不支持 ALTER TABLE DROP COLUMN，需要重建表
-- 删除的字段：probation_salary_cents, regular_salary_cents, living_allowance_cents, housing_allowance_cents, transportation_allowance_cents, meal_allowance_cents
-- ==================== ==================== ====================

-- 备份原表
ALTER TABLE employees RENAME TO employees_backup;

-- 创建新表（不包含 6 个冗余字段）
CREATE TABLE employees (
  id TEXT,
  name TEXT,
  department_id TEXT,
  join_date TEXT,
  status TEXT,
  regular_date TEXT,
  active INT,
  created_at INT,
  updated_at INT,
  phone TEXT,
  email TEXT,
  id_card TEXT,
  bank_name TEXT,
  bank_account TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  address TEXT,
  memo TEXT,
  usdt_address TEXT,
  org_department_id TEXT,
  birthday TEXT,
  position_id TEXT,
  work_schedule TEXT,
  annual_leave_cycle_months INT,
  annual_leave_days INT,
  personal_email TEXT
);

-- 迁移数据（不包含冗余字段）
INSERT INTO employees (
  id, name, department_id, join_date, status, regular_date,
  active, created_at, updated_at, phone, email, id_card, bank_name, bank_account,
  emergency_contact, emergency_phone, address, memo, usdt_address,
  org_department_id, birthday, position_id, work_schedule,
  annual_leave_cycle_months, annual_leave_days, personal_email
)
SELECT 
  id, name, department_id, join_date, status, regular_date,
  active, created_at, updated_at, phone, email, id_card, bank_name, bank_account,
  emergency_contact, emergency_phone, address, memo, usdt_address,
  org_department_id, birthday, position_id, work_schedule,
  annual_leave_cycle_months, annual_leave_days, personal_email
FROM employees_backup;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_org_department_id ON employees(org_department_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique ON employees(email);

-- 验证数据迁移
SELECT 'employees_count' AS check_type, COUNT(*) AS count FROM employees;
SELECT 'employees_backup_count' AS check_type, COUNT(*) AS count FROM employees_backup;

-- ⚠️ 确认数据无误后，手动执行以下语句删除备份表：
-- DROP TABLE employees_backup;
