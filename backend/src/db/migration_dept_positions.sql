-- 部门表添加职位配置字段
-- 执行时间: 2024年

PRAGMA foreign_keys = OFF;

-- 添加 allowed_positions 字段 (JSON数组，限制部门可用的职位)
ALTER TABLE org_departments ADD COLUMN allowed_positions TEXT;

-- 添加 default_position_id 字段 (新员工默认职位)
ALTER TABLE org_departments ADD COLUMN default_position_id TEXT;

PRAGMA foreign_keys = ON;

