-- 为 borrowings 表添加审批相关字段
ALTER TABLE borrowings ADD COLUMN status TEXT DEFAULT 'approved';
ALTER TABLE borrowings ADD COLUMN approved_by TEXT;
ALTER TABLE borrowings ADD COLUMN approved_at INTEGER;

-- 为现有记录设置默认状态为已通过（历史数据）
UPDATE borrowings SET status = 'approved' WHERE status IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id);
