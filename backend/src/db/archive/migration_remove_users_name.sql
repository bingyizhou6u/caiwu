-- 迁移脚本：从 users 表移除 name 字段
-- name 字段现在只存储在 employees 表中

PRAGMA foreign_keys = OFF;

-- 1. 创建备份表
CREATE TABLE users_backup_name_removal AS SELECT * FROM users;

-- 2. 创建新的 users 表（不包含 name 字段）
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  password_changed INTEGER DEFAULT 0,
  totp_secret TEXT,
  last_login_at INTEGER,
  created_at INTEGER
);

-- 3. 复制数据（排除 name 字段）
INSERT INTO users_new (
  id, email, password_hash, active, must_change_password, 
  password_changed, totp_secret, last_login_at, created_at
)
SELECT 
  id, email, password_hash, active, must_change_password, 
  password_changed, totp_secret, last_login_at, created_at
FROM users;

-- 4. 删除旧表并重命名新表
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- 5. 重建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

PRAGMA foreign_keys = ON;

-- 验证
SELECT '迁移完成: users 表 name 字段已移除' as status;
SELECT COUNT(*) as user_count FROM users;

