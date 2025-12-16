-- ==================== 报表查询性能优化索引 ====================
-- 创建时间: 2025-01-XX
-- 说明：为报表常用查询字段添加索引，提升报表查询性能
-- ==================== ==================== ====================

-- 薪资支付报表常用查询索引
CREATE INDEX IF NOT EXISTS idx_salary_payments_year_month 
  ON salary_payments(year, month, status);

CREATE INDEX IF NOT EXISTS idx_salary_payments_status 
  ON salary_payments(status);

CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_year_month 
  ON salary_payments(employee_id, year, month);

-- 请假记录报表常用查询索引
CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee_date 
  ON employee_leaves(employee_id, start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_status_date 
  ON employee_leaves(status, start_date, end_date);

-- 现金流报表常用查询索引
CREATE INDEX IF NOT EXISTS idx_cash_flows_date_type 
  ON cash_flows(biz_date, type);

CREATE INDEX IF NOT EXISTS idx_cash_flows_department_date 
  ON cash_flows(department_id, biz_date);

CREATE INDEX IF NOT EXISTS idx_cash_flows_category_date 
  ON cash_flows(category_id, biz_date);

-- 账户交易索引（用于余额查询）
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_date 
  ON account_transactions(account_id, transaction_date, created_at);

-- 借款报表索引
CREATE INDEX IF NOT EXISTS idx_borrowings_user_status 
  ON borrowings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_borrowings_date 
  ON borrowings(borrow_date);

-- 报销报表索引
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_employee_status 
  ON expense_reimbursements(employee_id, status);

CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_date 
  ON expense_reimbursements(expense_date);

