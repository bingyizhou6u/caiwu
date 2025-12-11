-- 移除users表的role、department_id和position_id字段
-- 创建时间: 2025-11-30
-- 说明：清理旧的role、department_id和position_id字段，完全使用基于职位的权限系统

-- SQLite不支持DROP COLUMN，需要重建表
-- 1. 创建新表
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  password_changed INTEGER DEFAULT 0,
  totp_secret TEXT,
  last_login_at INTEGER,
  created_at INTEGER
);

-- 2. 复制数据
INSERT INTO users_new 
SELECT id, email, name, password_hash, active, must_change_password, 
       password_changed, totp_secret, last_login_at, created_at
FROM users;

-- 3. 删除旧表
DROP TABLE users;

-- 4. 重命名新表
ALTER TABLE users_new RENAME TO users;

-- 5. 重建索引
CREATE INDEX idx_users_email ON users(email);

-- 验证
SELECT id, email, name, active FROM users;
