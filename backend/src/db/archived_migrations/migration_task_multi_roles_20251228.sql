-- 任务人员多选支持迁移
-- 添加 assigneeIds/reviewerIds/testerIds 字段 (JSON 数组格式)

ALTER TABLE tasks ADD COLUMN assignee_ids TEXT;
ALTER TABLE tasks ADD COLUMN reviewer_ids TEXT;
ALTER TABLE tasks ADD COLUMN tester_ids TEXT;

-- 迁移现有数据：将单个 ID 转换为 JSON 数组
UPDATE tasks SET assignee_ids = '["' || assignee_id || '"]' WHERE assignee_id IS NOT NULL AND assignee_ids IS NULL;
UPDATE tasks SET reviewer_ids = '["' || reviewer_id || '"]' WHERE reviewer_id IS NOT NULL AND reviewer_ids IS NULL;
UPDATE tasks SET tester_ids = '["' || tester_id || '"]' WHERE tester_id IS NOT NULL AND tester_ids IS NULL;
