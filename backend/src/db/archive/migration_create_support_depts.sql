-- 批量创建客服部

-- 总部客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  NULL,
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "report.*", "self.*"]',
  '["pos-hq-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ARCP 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-001',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- MT 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-002',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- TBAPI 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-003',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- XB 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-004',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- TB 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-005',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- HM 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-006',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- DV 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-008',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- ART 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-009',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- UP 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-010',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- CZ 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-011',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- SJ 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-012',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- LG 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-013',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- KB 项目客服部
INSERT INTO org_departments (id, project_id, parent_id, name, code, description, allowed_modules, allowed_positions, default_position_id, sort_order, active, created_at, updated_at)
VALUES (
  lower(hex(randomblob(16))),
  'dept-014',
  NULL,
  '客服部',
  'CS',
  '负责客户服务和支持工作',
  '["finance.ar", "finance.ap", "self.*"]',
  '["pos-project-support", "pos-team-leader", "pos-team-support"]',
  'pos-team-support',
  5,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

