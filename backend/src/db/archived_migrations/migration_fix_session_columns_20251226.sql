-- =====================================================
-- 迁移脚本: 修复 sessions 和 trusted_devices 表列名
-- 创建时间: 2025-12-26
-- 说明: 将 user_id 列改为 employee_id（users 表已合并到 employees）
-- =====================================================
--
-- ⚠️ 重要提示：
-- 1. 此迁移会清空 sessions 和 trusted_devices 表的所有数据
-- 2. 所有用户需要重新登录
-- 3. 所有受信任设备需要重新验证
--
-- 执行命令：
-- wrangler d1 execute caiwu-db --file=./src/db/migration_fix_session_columns_20251226.sql
-- =====================================================

-- 1. 重建 sessions 表
DROP TABLE IF EXISTS sessions_new;

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER,
  last_active_at INTEGER
);

-- 迁移数据（将 user_id 映射到 employee_id）
INSERT INTO sessions_new (id, employee_id, expires_at, ip_address, user_agent, created_at, last_active_at)
SELECT id, user_id, expires_at, ip_address, user_agent, created_at, last_active_at 
FROM sessions;

-- 替换旧表
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

-- 2. 重建 trusted_devices 表
DROP TABLE IF EXISTS trusted_devices_new;

CREATE TABLE trusted_devices_new (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_used_at INTEGER,
  created_at INTEGER
);

-- 迁移数据
INSERT INTO trusted_devices_new (id, employee_id, device_fingerprint, device_name, ip_address, user_agent, last_used_at, created_at)
SELECT id, user_id, device_fingerprint, device_name, ip_address, user_agent, last_used_at, created_at 
FROM trusted_devices;

-- 替换旧表
DROP TABLE trusted_devices;
ALTER TABLE trusted_devices_new RENAME TO trusted_devices;

-- =====================================================
-- 迁移完成
-- =====================================================
