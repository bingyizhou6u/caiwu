-- 迁移脚本：将总部的组织部门从 projectId IS NULL 改为使用总部的 department ID
-- 
-- 注意：此脚本需要在应用代码中执行，因为 SQLite 没有内置 UUID 生成函数
-- 实际执行时应该：
-- 1. 查找名称为"总部"的 department ID，如果不存在则创建一个（使用应用代码生成 UUID）
-- 2. 将所有 project_id IS NULL 的 org_departments 更新为该 department ID
--
-- 此 SQL 文件仅作为参考，实际迁移应该通过应用代码执行：
-- const hqDeptId = await projectDepartmentService.getOrCreateHQDepartmentId()
-- await db.prepare('UPDATE org_departments SET project_id = ? WHERE project_id IS NULL').bind(hqDeptId).run()

-- 如果总部部门已存在，更新所有 project_id IS NULL 的 org_departments
UPDATE org_departments
SET project_id = (SELECT id FROM departments WHERE name = '总部' LIMIT 1)
WHERE project_id IS NULL
  AND EXISTS (SELECT 1 FROM departments WHERE name = '总部');
