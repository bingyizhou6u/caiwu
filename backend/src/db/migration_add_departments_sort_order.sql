-- 迁移脚本：为 departments 表添加 sort_order 字段
-- 总部设置为 0（最优先），其他部门设置为 100

-- 添加 sort_order 字段
ALTER TABLE departments ADD COLUMN sort_order INTEGER DEFAULT 100;

-- 将总部部门的 sort_order 设置为 0（最优先）
UPDATE departments SET sort_order = 0 WHERE name = '总部';
