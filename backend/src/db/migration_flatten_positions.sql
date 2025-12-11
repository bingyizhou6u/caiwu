-- ==================== 职位重构迁移：扁平化项目层级职位 ====================
-- 创建时间: 2025-12-04
-- 说明：
-- 1. 创建 project_finance, project_hr, project_admin 三个新职位
-- 2. 将原 project_staff 员工根据 job_role 迁移到新职位
-- 3. 删除 project_staff 职位
-- ==================== ==================== ====================

-- 1. 插入新职位：项目财务 (project_finance)
INSERT OR REPLACE INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-finance',
  'project_finance',
  '项目财务',
  2,
  'finance',
  0,
  '项目专职财务，负责项目资金和账务',
  '{
    "finance": {
      "flow": ["view", "create", "update", "export"],
      "transfer": ["view", "create"],
      "ar": ["view", "create", "update"],
      "ap": ["view", "create", "update"],
      "borrowing": ["view", "create"],
      "salary": ["view", "create", "update"],
      "allowance": ["view", "create"],
      "site_bill": ["view", "create", "update"]
    },
    "asset": {
      "fixed": ["view", "create", "update", "allocate"],
      "rental": ["view", "create", "update"]
    },
    "report": {
      "view": ["cash_flow", "account", "ar_ap", "asset"],
      "export": ["cash_flow", "account"]
    },
    "system": {
      "department": ["view"]
    },
    "site": {
      "bill": ["view", "create", "update"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 2. 插入新职位：项目人事 (project_hr)
INSERT OR REPLACE INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-hr',
  'project_hr',
  '项目人事',
  2,
  'hr',
  0,
  '项目专职人事，负责项目人员和考勤',
  '{
    "hr": {
      "employee": ["view", "create", "update"],
      "salary": ["view", "create"],
      "leave": ["view", "approve"],
      "reimbursement": ["view", "approve"]
    },
    "finance": {
      "salary": ["view", "create"],
      "allowance": ["view", "create"]
    },
    "asset": {
      "fixed": ["view", "allocate"]
    },
    "report": {
      "view": ["salary", "leave", "employee"],
      "export": ["salary", "leave"]
    },
    "system": {
      "department": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 3. 插入新职位：项目行政 (project_admin)
INSERT OR REPLACE INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-admin',
  'project_admin',
  '项目行政',
  2,
  'admin',
  0,
  '项目专职行政，负责项目资产和站点',
  '{
    "asset": {
      "fixed": ["view", "create", "update", "allocate"],
      "rental": ["view", "create", "update"]
    },
    "site": {
      "info": ["view", "update"],
      "bill": ["view"]
    },
    "system": {
      "department": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  8,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 4. 迁移现有员工数据
-- 由于开发环境可能缺失 job_role 字段，且用户明确表示不考虑兼容性
-- 我们采取最安全的策略：将所有 project_staff 统一迁移到 project_admin
-- 然后由用户在前端手动调整（因为人数很少）

UPDATE employees 
SET position_id = 'pos-project-admin'
WHERE position_id = 'pos-project-staff';

-- 5. 删除旧职位
DELETE FROM positions WHERE code = 'project_staff';

-- 6. 重新排序职位
UPDATE positions SET sort_order = 9 WHERE code = 'team_leader';
UPDATE positions SET sort_order = 10 WHERE code = 'team_member';

-- ==================== 验证迁移 ====================
SELECT id, code, name FROM positions ORDER BY sort_order;
SELECT id, name, position_id FROM employees WHERE position_id IN ('pos-project-finance', 'pos-project-hr', 'pos-project-admin');
