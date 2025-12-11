-- ==================== 职位权限优化迁移 ====================
-- 创建时间: 2025-12-03
-- 说明：根据用户反馈优化各角色权限
-- 1. HR/财务/行政角色添加部门查看权限
-- 2. 财务角色添加资产报表查看权限
-- ==================== ==================== ====================

-- 1. 更新总部人事（hq_hr）：添加部门查看权限
UPDATE positions SET permissions = json_patch(permissions, '{
  "system": {
    "user": ["view", "create", "update"],
    "audit": ["view"],
    "department": ["view"]
  }
}')
WHERE code = 'hq_hr';

-- 2. 更新总部财务（hq_finance）：添加资产报表查看权限 + 确保有部门查看权限
UPDATE positions SET permissions = json_patch(permissions, '{
  "system": {
    "department": ["view", "create", "update"]
  },
  "report": {
    "view": ["cash_flow", "salary", "account", "ar_ap", "asset"],
    "export": ["cash_flow", "salary", "account", "ar_ap"]
  }
}')
WHERE code = 'hq_finance';

-- 3. 更新项目人事（project_hr）：添加部门查看权限
UPDATE positions SET permissions = json_patch(permissions, '{
  "system": {
    "department": ["view"]
  }
}')
WHERE code = 'project_hr';

-- 4. 更新项目财务（project_finance）：添加部门查看权限 + 资产报表查看权限
UPDATE positions SET permissions = json_patch(permissions, '{
  "system": {
    "department": ["view"]
  },
  "report": {
    "view": ["cash_flow", "account", "ar_ap", "asset"],
    "export": ["cash_flow", "account"]
  }
}')
WHERE code = 'project_finance';

-- 5. 更新项目行政（project_admin）：添加部门查看权限
UPDATE positions SET permissions = json_patch(permissions, '{
  "system": {
    "department": ["view"]
  }
}')
WHERE code = 'project_admin';

-- ==================== 验证更新 ====================
SELECT code, name, json_extract(permissions, '$.system.department') as dept_perm, json_extract(permissions, '$.report.view') as report_view FROM positions WHERE code IN ('hq_hr', 'hq_finance', 'project_hr', 'project_finance', 'project_admin');
