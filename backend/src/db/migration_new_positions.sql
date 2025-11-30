-- 全新职位权限系统迁移
-- 创建时间: 2025-11-30
-- 说明：重新设计8个职位，不考虑向后兼容

-- ==================== 第一步：清理旧数据 ====================

-- 删除职位权限关联（如果存在）
DROP TABLE IF EXISTS position_permissions;

-- 备份旧职位数据到临时表
CREATE TABLE positions_backup AS SELECT * FROM positions;

-- 删除旧职位表
DROP TABLE positions;

-- ==================== 第二步：创建新的职位表 ====================

CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,                    -- 1-总部 2-项目 3-研发组
  data_scope TEXT NOT NULL,                  -- all/hq_all/project/group
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

-- 4. 总部其他部门
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-hq-staff',
  'hq_staff',
  '总部其他部门',
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

-- 6. 项目财务
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-finance',
  'project_finance',
  '项目财务',
  2,
  'project',
  0,
  '处理本项目财务，接受总部财务管理',
  '{
    "finance": {
      "flow": ["view", "create", "update", "export"],
      "transfer": ["view", "create"],
      "ar": ["view", "create", "update"],
      "ap": ["view", "create", "update"],
      "borrowing": ["view", "create"]
    },
    "hr": {
      "reimbursement": ["view"]
    },
    "asset": {
      "fixed": ["view"],
      "rental": ["view"]
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
  6,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 7. 项目人事
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-project-hr',
  'project_hr',
  '项目人事',
  2,
  'project',
  0,
  '处理本项目人事，接受总部人事管理',
  '{
    "hr": {
      "employee": ["view", "create", "update"],
      "salary": ["view", "create"],
      "leave": ["view", "approve"],
      "reimbursement": ["view", "approve"]
    },
    "report": {
      "view": ["salary", "leave", "employee"],
      "export": ["salary", "leave"]
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
  7,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 8. 研发组长
INSERT INTO positions (id, code, name, level, data_scope, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES (
  'pos-dev-team-leader',
  'dev_team_leader',
  '研发组长',
  3,
  'group',
  1,
  '管理本组成员，分配开发任务',
  '{
    "hr": {
      "employee": ["view"],
      "leave": ["view", "approve"]
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
  8,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ==================== 第四步：数据验证 ====================

-- 查看新职位
SELECT id, code, name, level, data_scope, can_manage_subordinates FROM positions ORDER BY sort_order;
