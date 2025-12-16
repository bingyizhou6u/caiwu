-- 创建迁移追踪表
-- 用于记录已执行的数据库迁移脚本，确保迁移的可追溯性和安全性

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,           -- 迁移文件版本标识（文件名）
    name TEXT NOT NULL,                 -- 迁移名称（描述性名称）
    executed_at INTEGER NOT NULL,       -- 执行时间戳（Unix timestamp）
    checksum TEXT                       -- 迁移文件内容的 SHA-256 校验和，用于验证文件完整性
);

-- 创建索引以支持按执行时间查询
CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
    ON schema_migrations(executed_at DESC);

