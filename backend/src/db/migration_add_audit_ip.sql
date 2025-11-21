-- 为审计日志表添加IP和IP归属地字段
ALTER TABLE audit_logs ADD COLUMN ip TEXT;
ALTER TABLE audit_logs ADD COLUMN ip_location TEXT;

