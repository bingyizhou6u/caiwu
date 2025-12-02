-- 创建站点配置表
CREATE TABLE IF NOT EXISTS site_config (
  id TEXT PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT,
  description TEXT,
  is_encrypted INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(config_key);

-- 插入默认配置项
INSERT OR IGNORE INTO site_config (id, config_key, config_value, description, is_encrypted, created_at, updated_at)
VALUES 
  (lower(hex(randomblob(16))), 'SITE_NAME', 'AR公司管理系统', '站点名称', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  (lower(hex(randomblob(16))), 'CONTACT_EMAIL', '', '联系邮箱', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  (lower(hex(randomblob(16))), 'COMPANY_NAME', '', '公司名称', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  (lower(hex(randomblob(16))), 'RESEND_API_KEY', '', 'Resend API Key', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
