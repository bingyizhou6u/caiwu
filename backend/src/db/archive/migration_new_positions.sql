-- 全新职位权限系统迁移
-- 创建时间: 2025-11-30
-- 说明：重新设计8个职位，不考虑向后兼容

-- ==================== 第一步：清理旧数据 ====================

-- 备份旧职位数据（如果表存在）
DROP TABLE IF EXISTS positions_backup;
CREATE TABLE positions_backup AS SELECT * FROM positions WHERE 1=0;
INSERT INTO positions_backup SELECT * FROM positions;

-- 删除旧职位表
DROP TABLE IF EXISTS positions;
DROP INDEX IF EXISTS idx_positions_code;
DROP INDEX IF EXISTS idx_positions_level;
DROP INDEX IF EXISTS idx_positions_active;

-- ==================== 第二步：创建新的职位表 ====================

CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,                    -- 1-总部 2-项目 3-研发组
  data_scope TEXT NOT NULL,                  -- all/hq_all/project/group/self
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

-- 为employees表添加job_role字段（仅project_staff使用）
ALTER TABLE employees ADD COLUMN job_role TEXT; -- finance/hr/admin

-- ==================== 第三步：插入8个标准职位 ====================

-- 1. 总部负责人
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-director',
  'hq_director',
  '总部负责人',
  1,
  'all',
  1,
  '管理所有项目和总部，拥有系统最高权限',
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
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 2. 总部财务
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-finance',
  'hq_finance',
  '总部财务',
  1,
  'all',
  0,
  '管理所有项目的财务，指导项目财务工作',
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

-- 3. 总部人事
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-hr',
  'hq_hr',
  '总部人事',
  1,
  'all',
  0,
  '管理所有项目的人事，指导项目人事工作',
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
  3,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 4. 总部行政
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-admin',
  'hq_admin',
  '总部行政',
  1,
  'hq_all',
  0,
  '总部行政、资产等支持职能',
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

-- 5. 项目负责人
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-director',
  'project_director',
  '项目负责人',
  2,
  'project',
  1,
  '管理本项目所有事务，对总部负责',
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
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"]
    }
  }',
  5,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 6. 项目职能人员（通过job_role区分：finance/hr/admin）
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-staff',
  'project_staff',
  '项目职能人员',
  2,
  'project',
  0,
  '项目财务/人事/行政，接受总部管理',
  '{
    "finance": {
      "flow": ["view", "create", "update", "export"],
      "transfer": ["view", "create"],
      "ar": ["view", "create", "update"],
      "ap": ["view", "create", "update"],
      "borrowing": ["view", "create"]
    },
    "hr": {
      "employee": ["view", "create", "update"],
      "salary": ["view", "create"],
      "leave": ["view", "approve"],
      "reimbursement": ["view", "approve"]
    },
    "asset": {
      "fixed": ["view", "create", "update"],
      "rental": ["view", "create", "update"]
    },
    "report": {
      "view": ["cash_flow", "salary", "leave", "employee", "account", "ar_ap", "asset"],
      "export": ["cash_flow", "salary", "leave", "account"]
    },
    "system": {
      "user": ["view", "create"]
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

-- 7. 组长（适用于所有组：前端/后端/运维/测试/产品/UI）
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-team-leader',
  'team_leader',
  '组长',
  3,
  'group',
  1,
  '管理本组成员，审批组员申请',
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
      "salary": ["view"]
    }
  }',
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 8. 组员（适用于所有组员）
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-team-member',
  'team_member',
  '组员',
  3,
  'self',
  0,
  '普通组员，只能查看和操作自己的数据',
  '{
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

-- ==================== 第四步：数据验证 ====================

-- 查看新职位
SELECT id, code, name, level, data_scope, can_manage_subordinates FROM positions ORDER BY sort_order;
