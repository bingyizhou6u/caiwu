-- 为组织部门添加模块权限配置
-- 允许不同部门（如人事部、客服组、行政部）配置可访问的功能模块

-- 添加 allowed_modules 字段（JSON数组格式）
ALTER TABLE org_departments ADD COLUMN allowed_modules TEXT;

-- 示例数据初始化（可根据实际情况调整）

-- 人事类部门：员工管理、考勤、请假
UPDATE org_departments SET allowed_modules = '["hr.*", "self.*"]'
WHERE name LIKE '%人事%' OR name LIKE '%HR%' OR name LIKE '%人力%';

-- 财务类部门：财务流水、报表
UPDATE org_departments SET allowed_modules = '["finance.*", "report.*", "self.*"]'
WHERE name LIKE '%财务%' OR name LIKE '%Finance%';

-- 行政类部门：资产管理、采购
UPDATE org_departments SET allowed_modules = '["asset.*", "system.*", "self.*"]'
WHERE name LIKE '%行政%' OR name LIKE '%Admin%';

-- 客服类部门：工单、客户信息
UPDATE org_departments SET allowed_modules = '["ticket.*", "customer.*", "self.*"]'
WHERE name LIKE '%客服%' OR name LIKE '%客户%' OR name LIKE '%Support%';

-- 默认：未分类的部门给予基础权限
UPDATE org_departments SET allowed_modules = '["self.*"]'
WHERE allowed_modules IS NULL;

-- 总部级/顶层部门：给予所有权限
UPDATE org_departments SET allowed_modules = '["*"]'
WHERE parent_id IS NULL OR parent_id = '';

