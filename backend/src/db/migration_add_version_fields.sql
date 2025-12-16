-- ==================== 添加版本字段实现乐观锁 ====================
-- 创建时间: 2025-01-XX
-- 说明：为关键业务表添加 version 字段，实现乐观锁并发控制
-- ==================== ==================== ====================

-- 为薪资支付表添加版本字段
ALTER TABLE salary_payments ADD COLUMN version INTEGER DEFAULT 1;

-- 为借款表添加版本字段
ALTER TABLE borrowings ADD COLUMN version INTEGER DEFAULT 1;

-- 为报销表添加版本字段
ALTER TABLE expense_reimbursements ADD COLUMN version INTEGER DEFAULT 1;

-- 为请假表添加版本字段
ALTER TABLE employee_leaves ADD COLUMN version INTEGER DEFAULT 1;

-- 为账户表添加版本字段（账户余额更新需要并发控制）
ALTER TABLE accounts ADD COLUMN version INTEGER DEFAULT 1;

-- 更新现有记录的版本号
UPDATE salary_payments SET version = 1 WHERE version IS NULL;
UPDATE borrowings SET version = 1 WHERE version IS NULL;
UPDATE expense_reimbursements SET version = 1 WHERE version IS NULL;
UPDATE employee_leaves SET version = 1 WHERE version IS NULL;
UPDATE accounts SET version = 1 WHERE version IS NULL;

