-- 为 vendors 表添加缺失的列
ALTER TABLE vendors ADD COLUMN phone TEXT;
ALTER TABLE vendors ADD COLUMN email TEXT;
ALTER TABLE vendors ADD COLUMN address TEXT;
ALTER TABLE vendors ADD COLUMN memo TEXT;
ALTER TABLE vendors ADD COLUMN active INTEGER DEFAULT 1;
ALTER TABLE vendors ADD COLUMN created_at INTEGER;
ALTER TABLE vendors ADD COLUMN updated_at INTEGER;

-- 为现有记录设置默认值
UPDATE vendors SET active = 1 WHERE active IS NULL;
UPDATE vendors SET created_at = strftime('%s', 'now') * 1000 WHERE created_at IS NULL;
UPDATE vendors SET updated_at = strftime('%s', 'now') * 1000 WHERE updated_at IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(active);
