-- 创建供应商表
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  memo TEXT,
  active INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(active);
