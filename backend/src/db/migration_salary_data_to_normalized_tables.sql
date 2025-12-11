-- ==================== 薪资数据迁移到规范化表 ====================
-- 创建时间: 2025-12-08
-- 说明：将 employees 表中的薪资/津贴数据迁移到规范化表
-- ⚠️ 此脚本应在删除字段之前执行
-- ==================== ==================== ====================

-- 1. 迁移试用期薪资到 employee_salaries 表
INSERT OR IGNORE INTO employee_salaries (id, employee_id, salary_type, currency_id, amount_cents, effective_date, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'probation',
    'CNY',
    probation_salary_cents,
    join_date,
    created_at,
    updated_at
FROM employees
WHERE probation_salary_cents IS NOT NULL 
  AND probation_salary_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_salaries WHERE salary_type = 'probation');

-- 2. 迁移正式薪资到 employee_salaries 表
INSERT OR IGNORE INTO employee_salaries (id, employee_id, salary_type, currency_id, amount_cents, effective_date, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'regular',
    'CNY',
    regular_salary_cents,
    COALESCE(regular_date, join_date),
    created_at,
    updated_at
FROM employees
WHERE regular_salary_cents IS NOT NULL 
  AND regular_salary_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_salaries WHERE salary_type = 'regular');

-- 3. 迁移生活补贴到 employee_allowances 表
INSERT OR IGNORE INTO employee_allowances (id, employee_id, allowance_type, currency_id, amount_cents, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'living',
    'CNY',
    living_allowance_cents,
    created_at,
    updated_at
FROM employees
WHERE living_allowance_cents IS NOT NULL 
  AND living_allowance_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_allowances WHERE allowance_type = 'living');

-- 4. 迁移住房补贴
INSERT OR IGNORE INTO employee_allowances (id, employee_id, allowance_type, currency_id, amount_cents, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'housing',
    'CNY',
    housing_allowance_cents,
    created_at,
    updated_at
FROM employees
WHERE housing_allowance_cents IS NOT NULL 
  AND housing_allowance_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_allowances WHERE allowance_type = 'housing');

-- 5. 迁移交通补贴
INSERT OR IGNORE INTO employee_allowances (id, employee_id, allowance_type, currency_id, amount_cents, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'transportation',
    'CNY',
    transportation_allowance_cents,
    created_at,
    updated_at
FROM employees
WHERE transportation_allowance_cents IS NOT NULL 
  AND transportation_allowance_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_allowances WHERE allowance_type = 'transportation');

-- 6. 迁移餐饮补贴
INSERT OR IGNORE INTO employee_allowances (id, employee_id, allowance_type, currency_id, amount_cents, created_at, updated_at)
SELECT 
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    id,
    'meal',
    'CNY',
    meal_allowance_cents,
    created_at,
    updated_at
FROM employees
WHERE meal_allowance_cents IS NOT NULL 
  AND meal_allowance_cents > 0
  AND id NOT IN (SELECT employee_id FROM employee_allowances WHERE allowance_type = 'meal');

-- ==================== 验证迁移结果 ====================
SELECT 'employee_salaries_count' AS check_type, COUNT(*) AS count FROM employee_salaries;
SELECT 'employee_allowances_count' AS check_type, COUNT(*) AS count FROM employee_allowances;
