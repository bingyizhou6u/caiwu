-- ==================== 添加薪资支付回退字段 ====================
-- 创建时间: 2025-01-XX
-- 说明：为薪资支付表添加回退相关字段，支持流程回退功能
-- ==================== ==================== ====================

-- 添加回退相关字段
ALTER TABLE salary_payments ADD COLUMN rollback_reason TEXT;
ALTER TABLE salary_payments ADD COLUMN rollback_by TEXT;
ALTER TABLE salary_payments ADD COLUMN rollback_at INTEGER;

