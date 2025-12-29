-- Migration: Optimize Roles and Data Scopes
-- Date: 2025-12-28

-- 1. Disable legacy hq_staff role
UPDATE positions SET active = 0 WHERE code = 'hq_staff';

-- 2. Update Project Level Roles (Self -> Project)
UPDATE positions SET data_scope = 'project' WHERE code = 'project_finance';
UPDATE positions SET data_scope = 'project' WHERE code = 'project_hr';
UPDATE positions SET data_scope = 'project' WHERE code = 'project_admin';

-- 3. Update Team Level Roles (Self -> Group)
UPDATE positions SET data_scope = 'group' WHERE code = 'team_leader';

-- 4. Create New HQ Roles

-- HQ Finance (Derived from hq_manager but focused on Finance)
INSERT INTO positions (id, code, name, data_scope, permissions, description, sort_order, active, created_at, updated_at)
VALUES (
  'pos_hq_finance_' || hex(randomblob(4)),
  'hq_finance',
  '总部财务',
  'all',
  '{"finance":{"flow":["view","create","update","delete","export"],"transfer":["view","create","update","delete","approve"],"ar":["view","create","update","delete"],"ap":["view","create","update","delete"],"borrowing":["view","create","approve","reject"],"salary":["view","create","update","delete","approve"],"allowance":["view","create","update","delete"],"site_bill":["view","create","update","delete"]},"report":{"finance":["view","export"],"salary":["view","export"]},"system":{"account":["view","create","update","delete"],"category":["view","create","update","delete"],"currency":["view","create","update","delete"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}',
  '总部专职财务，负责全局资金核算与审计',
  11,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- HQ HR (Derived from hq_manager but focused on HR)
INSERT INTO positions (id, code, name, data_scope, permissions, description, sort_order, active, created_at, updated_at)
VALUES (
  'pos_hq_hr_' || hex(randomblob(4)),
  'hq_hr',
  '总部人事',
  'all',
  '{"hr":{"employee":["view","create","update","delete"],"salary":["view","create","update","approve"],"leave":["view","approve","reject"],"reimbursement":["view","approve","reject"]},"report":{"hr":["view","export"],"salary":["view","export"]},"system":{"department":["view","create","update","delete"],"position":["view","create","update","delete"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}',
  '总部专职人事，负责全局人员与薪酬管理',
  12,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

-- HQ Admin (Derived from hq_manager but focused on Assets/Site)
INSERT INTO positions (id, code, name, data_scope, permissions, description, sort_order, active, created_at, updated_at)
VALUES (
  'pos_hq_admin_' || hex(randomblob(4)),
  'hq_admin',
  '总部行政',
  'all',
  '{"asset":{"fixed":["view","create","update","delete","allocate"],"rental":["view","create","update","delete"]},"site":{"info":["view","create","update","delete"],"bill":["view","create","update","delete"]},"report":{"asset":["view","export"]},"system":{"department":["view"],"site_config":["manage"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}',
  '总部专职行政，负责全局资产与站点管理',
  13,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);
