-- Migration: Add missing indexes identified in Audit Report 2024-12-17

-- 1. Index for Account Transactions (Query by Account + Date)
CREATE INDEX IF NOT EXISTS idx_acc_tx_account_date ON account_transactions (account_id, transaction_date);

-- 2. Indexes for Audit Logs (Query by Time and Entity)
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs (at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_id);

-- 3. Indexes for Cash Flows (Query by Account+Date, Type)
CREATE INDEX IF NOT EXISTS idx_cash_flows_account_biz ON cash_flows (account_id, biz_date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_type ON cash_flows (type);
