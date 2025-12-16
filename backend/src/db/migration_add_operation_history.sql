-- ==================== 添加业务操作历史表 ====================
-- 创建时间: 2025-01-XX
-- 说明：为关键业务实体添加操作历史追踪功能
-- ==================== ==================== ====================

CREATE TABLE IF NOT EXISTS business_operation_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'salary_payment', 'borrowing', 'reimbursement', 'leave', etc.
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'approved', 'rejected', 'rolled_back', etc.
  operator_id TEXT,
  operator_name TEXT,
  before_data TEXT, -- JSON
  after_data TEXT, -- JSON
  memo TEXT,
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_operation_history_entity 
  ON business_operation_history(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_operation_history_operator 
  ON business_operation_history(operator_id);

CREATE INDEX IF NOT EXISTS idx_operation_history_created_at 
  ON business_operation_history(created_at DESC);

