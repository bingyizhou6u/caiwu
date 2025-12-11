-- 部门预设数据配置
-- 为各部门设置合适的可用模块、可用职位和默认职位

-- ========== 总部部门配置 ==========

-- 总部人事部：人事管理、报表、个人中心
UPDATE org_departments SET 
  allowed_modules = '["hr.*", "report.*", "self.*"]',
  allowed_positions = '["pos-hq-hr", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'HR' AND project_id IS NULL;

-- 总部财务部：财务管理、报表、个人中心
UPDATE org_departments SET 
  allowed_modules = '["finance.*", "report.*", "self.*"]',
  allowed_positions = '["pos-hq-finance", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'FIN' AND project_id IS NULL;

-- 总部行政部：资产管理、站点管理、系统管理、个人中心
UPDATE org_departments SET 
  allowed_modules = '["asset.*", "site.*", "system.department", "system.orgDepartment", "report.*", "self.*"]',
  allowed_positions = '["pos-hq-admin", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'ADM' AND project_id IS NULL;

-- 总部开发部：个人中心（开发人员主要用于系统开发，不参与业务）
UPDATE org_departments SET 
  allowed_modules = '["self.*"]',
  allowed_positions = '["pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'DEV' AND project_id IS NULL;

-- ========== 项目级部门配置 ==========

-- 项目人事部：人事管理、个人中心
UPDATE org_departments SET 
  allowed_modules = '["hr.*", "self.*"]',
  allowed_positions = '["pos-project-hr", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'HR' AND project_id IS NOT NULL;

-- 项目财务部：财务管理、报表、个人中心
UPDATE org_departments SET 
  allowed_modules = '["finance.*", "report.*", "self.*"]',
  allowed_positions = '["pos-project-finance", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'FIN' AND project_id IS NOT NULL;

-- 项目行政部：资产管理、站点管理、个人中心
UPDATE org_departments SET 
  allowed_modules = '["asset.*", "site.*", "self.*"]',
  allowed_positions = '["pos-project-admin", "pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'ADM' AND project_id IS NOT NULL;

-- 项目开发部：个人中心
UPDATE org_departments SET 
  allowed_modules = '["self.*"]',
  allowed_positions = '["pos-team-leader", "pos-team-developer"]',
  default_position_id = 'pos-team-developer'
WHERE code = 'DEV' AND project_id IS NOT NULL;

-- ========== 特殊部门（总部管理层）==========

-- 总部总部门：所有权限
UPDATE org_departments SET 
  allowed_modules = '["*"]',
  allowed_positions = '["pos-hq-director", "pos-hq-hr", "pos-hq-finance", "pos-hq-admin"]',
  default_position_id = NULL
WHERE name = '总部' AND code IS NULL AND project_id IS NULL;

