-- 任务环节人员字段迁移
-- 添加 reviewerId (审核人员) 和 testerId (测试人员) 字段

ALTER TABLE tasks ADD COLUMN reviewer_id TEXT;
ALTER TABLE tasks ADD COLUMN tester_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tester ON tasks(tester_id);
