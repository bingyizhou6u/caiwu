-- ==================== 修复报表权限格式 ====================
-- 创建时间: 2025-12-16
-- 说明：修复报表权限格式，为所有职位添加 report.finance 权限
-- 代码检查格式：hasPermission(c, 'report', 'finance', 'view')
-- 需要的权限格式：report.finance: ["view"]
-- ==================== ==================== ====================

-- 1. 总部管理层职位：完整报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.hr', json('["view", "export"]'),
  '$.report.salary', json('["view", "export"]'),
  '$.report.asset', json('["view", "export"]')
)
WHERE code IN ('hq_manager', 'hq_staff', 'hq_admin', 'hq_support', 'hq_developer');

-- 2. 总部财务：财务报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.salary', json('["view"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'hq_finance';

-- 3. 总部人事：HR报表 + 基础财务报表
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.hr', json('["view", "export"]'),
  '$.report.salary', json('["view", "export"]')
)
WHERE code = 'hq_hr';

-- 4. 项目主管：项目级报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.hr', json('["view"]'),
  '$.report.salary', json('["view"]')
)
WHERE code = 'project_manager';

-- 5. 项目财务：财务报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view", "export"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'project_finance';

-- 6. 项目人事：HR报表 + 基础财务报表
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.hr', json('["view"]'),
  '$.report.salary', json('["view"]')
)
WHERE code = 'project_hr';

-- 7. 项目行政：基础报表权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.asset', json('["view"]')
)
WHERE code = 'project_admin';

-- 8. 项目/组级其他职位：基础查看权限
UPDATE positions SET permissions = json_set(
  COALESCE(permissions, '{}'),
  '$.report.finance', json('["view"]'),
  '$.report.hr', json('["view"]'),
  '$.report.salary', json('["view"]')
)
WHERE code IN ('project_support', 'team_leader', 'team_support', 'team_engineer');

-- ==================== 验证更新 ====================
SELECT 
  code, 
  name, 
  json_extract(permissions, '$.report.finance') as report_finance
FROM positions;
