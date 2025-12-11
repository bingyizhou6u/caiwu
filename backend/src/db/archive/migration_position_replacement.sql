-- 职位权限体系完全替换迁移脚本
-- 创建时间: 2025-11-30
-- 说明：采用"职能角色 + 组织层级"的交叉组合模型，定义10个标准职位

-- 禁用外键约束（D1需要在同一批次中执行）
PRAGMA foreign_keys=OFF;

-- ==================== 第一步：备份现有数据 ====================

-- 备份现有positions数据
DROP TABLE IF EXISTS positions_backup_20251130;
CREATE TABLE positions_backup_20251130 AS SELECT * FROM positions;

-- 备份现有employees数据
DROP TABLE IF EXISTS employees_backup_20251130;
CREATE TABLE employees_backup_20251130 AS SELECT * FROM employees;

-- ==================== 第二步：删除旧表并重建 ====================

-- 删除positions表
DROP TABLE IF EXISTS positions;
DROP INDEX IF EXISTS idx_positions_code;
DROP INDEX IF EXISTS idx_positions_level;
DROP INDEX IF EXISTS idx_positions_active;

-- 重新创建positions表（移除data_scope，增加function_role）
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,                    -- 1-总部 2-项目 3-组
  function_role TEXT NOT NULL,               -- director/hr/finance/admin/developer
  can_manage_subordinates INTEGER DEFAULT 0, -- 是否可以管理下属
  description TEXT,
  permissions TEXT NOT NULL,                 -- JSON权限配置
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX idx_positions_code ON positions(code);
CREATE INDEX idx_positions_level ON positions(level);
CREATE INDEX idx_positions_active ON positions(active);
CREATE INDEX idx_positions_function_role ON positions(function_role);

-- 从employees表删除job_role字段（如果存在）
-- SQLite不支持直接DROP COLUMN，需要重建表
CREATE TABLE employees_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position_id TEXT,
  org_department_id TEXT,
  department_id TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- 复制数据（排除job_role字段）
INSERT INTO employees_new (id, email, name, position_id, org_department_id, department_id, active, created_at, updated_at)
SELECT id, email, name, position_id, org_department_id, department_id, active, created_at, updated_at
FROM employees;

-- 删除旧表，重命名新表
DROP TABLE employees;
ALTER TABLE employees_new RENAME TO employees;

-- 重建索引
CREATE INDEX idx_employees_department_id ON employees(department_id);
CREATE INDEX idx_employees_org_department_id ON employees(org_department_id);
CREATE INDEX idx_employees_active ON employees(active);

-- ==================== 第三步：插入10个标准职位 ====================

-- 1. 总部负责人（hq_director）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-director',
  'hq_director',
  '总部负责人',
  1,
  'director',
  1,
  '负责人参与范围内的全部事项，拥有总部和所有项目的最高权限',
  '{
    "finance": {
      "flow": ["view", "create", "update", "delete", "export"],
      "transfer": ["view", "create", "update", "delete", "approve"],
      "ar": ["view", "create", "update", "delete"],
      "ap": ["view", "create", "update", "delete"],
      "borrowing": ["view", "create", "approve", "reject"]
    },
    "hr": {
      "employee": ["view", "create", "update", "delete"],
      "salary": ["view", "create", "update", "approve"],
      "leave": ["view", "approve", "reject"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "asset": {
      "fixed": ["view", "create", "update", "delete", "allocate"],
      "rental": ["view", "create", "update", "delete"]
    },
    "report": {
      "view": ["all"],
      "export": ["all"]
    },
    "system": {
      "user": ["view", "create", "update", "delete"],
      "position": ["view", "create", "update", "delete"],
      "department": ["view", "create", "update", "delete"],
      "audit": ["view", "export"],
      "config": ["view", "update"]
    },
    "site": {
      "info": ["view", "create", "update", "delete"],
      "bill": ["view", "create", "update", "delete"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"],
      "borrowing": ["view", "create"]
    }
  }',
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 2. 总部人事（hq_hr）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-hr',
  'hq_hr',
  '总部人事',
  1,
  'hr',
  1,
  '负责所有项目的人事工作，包括员工管理、薪资、请假、报销等',
  '{
    "hr": {
      "employee": ["view", "create", "update", "delete"],
      "salary": ["view", "create", "update", "approve"],
      "leave": ["view", "approve", "reject"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "report": {
      "view": ["salary", "leave", "employee"],
      "export": ["salary", "leave"]
    },
    "system": {
      "user": ["view", "create", "update"],
      "audit": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  2,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 3. 总部财务（hq_finance）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-finance',
  'hq_finance',
  '总部财务',
  1,
  'finance',
  1,
  '负责所有项目的财务工作，可以查看和管理所有项目的财务数据',
  '{
    "finance": {
      "flow": ["view", "create", "update", "delete", "export"],
      "transfer": ["view", "create", "approve"],
      "ar": ["view", "create", "update", "delete"],
      "ap": ["view", "create", "update", "delete"],
      "borrowing": ["view", "create", "approve", "reject"]
    },
    "hr": {
      "salary": ["view", "export"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "asset": {
      "fixed": ["view"],
      "rental": ["view"]
    },
    "report": {
      "view": ["cash_flow", "salary", "account", "ar_ap"],
      "export": ["cash_flow", "salary", "account", "ar_ap"]
    },
    "system": {
      "audit": ["view"]
    },
    "site": {
      "bill": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 4. 总部行政（hq_admin）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-admin',
  'hq_admin',
  '总部行政',
  1,
  'admin',
  0,
  '负责总部的行政和资产管理工作',
  '{
    "asset": {
      "fixed": ["view", "create", "update"],
      "rental": ["view", "create", "update"]
    },
    "report": {
      "view": ["account", "asset"]
    },
    "system": {
      "department": ["view"]
    },
    "site": {
      "info": ["view", "create", "update"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  4,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 5. 项目负责人（project_director）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-director',
  'project_director',
  '项目负责人',
  2,
  'director',
  1,
  '负责人参与本项目范围内的全部事项，具有本项目的最高管理权限',
  '{
    "finance": {
      "flow": ["view", "export"],
      "transfer": ["view"],
      "ar": ["view"],
      "ap": ["view"],
      "borrowing": ["view", "approve"]
    },
    "hr": {
      "employee": ["view", "create", "update"],
      "salary": ["view"],
      "leave": ["view", "approve", "reject"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "asset": {
      "fixed": ["view", "create"],
      "rental": ["view", "create"]
    },
    "report": {
      "view": ["cash_flow", "salary", "account", "leave"],
      "export": ["cash_flow", "salary"]
    },
    "system": {
      "department": ["view", "create", "update"]
    },
    "site": {
      "info": ["view"],
      "bill": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"]
    }
  }',
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 6. 项目人事（project_hr）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-hr',
  'project_hr',
  '项目人事',
  2,
  'hr',
  1,
  '负责本项目的人事工作，权限范围限定在本项目',
  '{
    "hr": {
      "employee": ["view", "create", "update"],
      "salary": ["view", "create"],
      "leave": ["view", "approve", "reject"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "report": {
      "view": ["salary", "leave", "employee"],
      "export": ["salary", "leave"]
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

-- 7. 项目财务（project_finance）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-finance',
  'project_finance',
  '项目财务',
  2,
  'finance',
  0,
  '负责本项目的财务工作，权限范围限定在本项目',
  '{
    "finance": {
      "flow": ["view", "create", "update", "export"],
      "transfer": ["view", "create"],
      "ar": ["view", "create", "update"],
      "ap": ["view", "create", "update"],
      "borrowing": ["view", "create"]
    },
    "report": {
      "view": ["cash_flow", "account", "ar_ap"],
      "export": ["cash_flow", "account"]
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

-- 8. 项目行政（project_admin）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-admin',
  'project_admin',
  '项目行政',
  2,
  'admin',
  0,
  '负责本项目的行政和资产管理工作',
  '{
    "asset": {
      "fixed": ["view", "create", "update"],
      "rental": ["view", "create", "update"]
    },
    "site": {
      "info": ["view", "update"],
      "bill": ["view"]
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

-- 9. 组长（team_leader）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-team-leader',
  'team_leader',
  '组长',
  3,
  'director',
  1,
  '负责人角色，管理本组成员，审批组员的请假和报销申请',
  '{
    "hr": {
      "employee": ["view"],
      "leave": ["view", "approve", "reject"],
      "reimbursement": ["view", "approve", "reject"]
    },
    "report": {
      "view": ["leave"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"]
    }
  }',
  9,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 10. 组员（开发）（team_developer）
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-team-developer',
  'team_developer',
  '组员（开发）',
  3,
  'developer',
  0,
  '开发职能，只能访问个人中心功能，查看和操作自己的数据',
  '{
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"],
      "borrowing": ["view", "create"]
    }
  }',
  10,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ==================== 第四步：数据验证 ====================

-- 查看新职位（验证插入成功）
SELECT 
  id, 
  code, 
  name, 
  level, 
  function_role, 
  can_manage_subordinates, 
  description,
  sort_order
FROM positions 
ORDER BY sort_order;

-- 统计职位数量
SELECT COUNT(*) as position_count FROM positions;

-- 验证所有职位都有权限配置
SELECT 
  code, 
  name, 
  CASE 
    WHEN permissions IS NULL OR permissions = '' THEN 'NO'
    ELSE 'YES'
  END as has_permissions
FROM positions;

-- 重新启用外键约束
PRAGMA foreign_keys=ON;
