-- Migration: Add employee_projects table for multi-project support
-- Date: 2025-12-28

-- 创建员工-项目关联表
CREATE TABLE IF NOT EXISTS employee_projects (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  role TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_unq_ep_employee_project ON employee_projects(employee_id, project_id);
CREATE INDEX IF NOT EXISTS idx_ep_employee ON employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_ep_project ON employee_projects(project_id);

-- 迁移现有数据：将 employees.project_id 复制到关联表（设为主项目）
INSERT OR IGNORE INTO employee_projects (id, employee_id, project_id, is_primary, created_at)
SELECT 
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  id,
  project_id,
  1,
  strftime('%s', 'now') * 1000
FROM employees
WHERE project_id IS NOT NULL AND project_id != '';
