-- 添加现金流水红冲相关字段
-- Migration: Add cash flow reversal fields
-- Date: 2024-12-19

ALTER TABLE cash_flows ADD COLUMN is_reversal INTEGER DEFAULT 0;
ALTER TABLE cash_flows ADD COLUMN reversal_of_flow_id TEXT;
ALTER TABLE cash_flows ADD COLUMN is_reversed INTEGER DEFAULT 0;
ALTER TABLE cash_flows ADD COLUMN reversed_by_flow_id TEXT;

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_cash_flows_reversal ON cash_flows(reversal_of_flow_id);

-- 注释说明
-- is_reversal: 是否为红冲记录 (0=否, 1=是)
-- reversal_of_flow_id: 冲正的原始流水ID (外键关联)
-- is_reversed: 是否已被冲正 (0=否, 1=是)
-- reversed_by_flow_id: 冲正记录ID (外键关联)
