-- 会话管理增强迁移
-- 为 sessions 表添加设备信息和活跃时间字段

-- 添加新字段
ALTER TABLE sessions ADD COLUMN device_info TEXT;
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN created_at INTEGER;
ALTER TABLE sessions ADD COLUMN last_active_at INTEGER;

-- 为现有记录设置默认值
UPDATE sessions SET 
  created_at = COALESCE(created_at, strftime('%s', 'now') * 1000),
  last_active_at = COALESCE(last_active_at, strftime('%s', 'now') * 1000);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
