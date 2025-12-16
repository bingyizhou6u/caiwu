-- ==================== 修复报表权限格式 ====================
-- 创建时间: 2025-12-16
-- 说明：修复报表权限格式
-- 旧格式：report.view: ["cash_flow", ...]
-- 新格式：report.finance: ["view"], report.hr: ["view"], ...
-- ==================== ==================== ====================

-- 1. 更新总部负责人（hq_director）：添加所有报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.hr', json('["view", "export"]'),
  '$.report.salary', json('["view", "export"]'),
  '$.report.asset', json('["view", "export"]')
)
WHERE code = 'hq_director';

-- 2. 更新总部财务（hq_finance）：添加财务报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.salary', json('["view"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'hq_finance';

-- 3. 更新总部人事（hq_hr）：添加HR报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.hr', json('["view", "export"]'),
  '$.report.salary', json('["view", "export"]')
)
WHERE code = 'hq_hr';

-- 4. 更新项目主管（project_manager）：添加项目级报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.hr', json('["view"]'),
  '$.report.salary', json('["view"]')
)
WHERE code = 'project_manager';

-- 5. 更新项目财务（project_finance）：添加财务报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'project_finance';

-- 6. 更新项目人事（project_hr）：添加HR报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.hr', json('["view"]'),
  '$.report.salary', json('["view"]')
)
WHERE code = 'project_hr';

-- 7. 更新项目行政（project_admin）：添加基础报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'project_admin';

-- ==================== 验证更新 ====================
SELECT 
  code, 
  name, 
  json_extract(permissions, '$.report.finance') as report_finance,
  json_extract(permissions, '$.report.hr') as report_hr,
  json_extract(permissions, '$.report.salary') as report_salary
FROM positions 
WHERE code IN ('hq_director', 'hq_finance', 'hq_hr', 'project_manager', 'project_finance', 'project_hr', 'project_admin');
