-- 创建客服相关职位

-- 1. 总部客服主管
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, active, created_at, updated_at)
VALUES (
  'pos-hq-support',
  'hq_support',
  '总部客服',
  1,
  'support',
  1,
  '负责所有项目的客服工作，管理客服团队，处理客户问题升级',
  '{
    "finance": {
      "ar": ["view"],
      "ap": ["view"]
    },
    "hr": {
      "employee": ["view"]
    },
    "report": {
      "view": ["ar", "ap"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"],
      "borrowing": ["view", "create"]
    }
  }',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 2. 项目客服主管
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, active, created_at, updated_at)
VALUES (
  'pos-project-support',
  'project_support',
  '项目客服',
  2,
  'support',
  1,
  '负责本项目的客服工作，管理项目客服团队',
  '{
    "finance": {
      "ar": ["view"],
      "ap": ["view"]
    },
    "report": {
      "view": ["ar", "ap"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"],
      "borrowing": ["view", "create"]
    }
  }',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 3. 客服组员
INSERT INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, active, created_at, updated_at)
VALUES (
  'pos-team-support',
  'team_support',
  '客服组员',
  3,
  'support',
  0,
  '客服组员，处理日常客户咨询和问题',
  '{
    "finance": {
      "ar": ["view"]
    },
    "self": {
      "leave": ["view", "create"],
      "reimbursement": ["view", "create"],
      "salary": ["view"],
      "asset": ["view"],
      "borrowing": ["view", "create"]
    }
  }',
  6,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- 更新部门预设：为客服部添加配置
-- 总部客服部
UPDATE org_departments SET 
  allowed_modules = '["finance.ar", "finance.ap", "report.*", "self.*"]',
  allowed_positions = '["pos-hq-support", "pos-team-leader", "pos-team-support"]',
  default_position_id = 'pos-team-support'
WHERE code = 'CS' AND project_id IS NULL;

-- 项目客服部
UPDATE org_departments SET 
  allowed_modules = '["finance.ar", "finance.ap", "self.*"]',
  allowed_positions = '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  default_position_id = 'pos-team-support'
WHERE code = 'CS' AND project_id IS NOT NULL;

