-- 性能优化索引迁移
-- 创建时间: 2025-11-30

-- 现金流相关索引优化
CREATE INDEX IF NOT EXISTS idx_cash_flows_biz_date_dept ON cash_flows(biz_date, department_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_biz_date_site ON cash_flows(biz_date, site_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_dept_date ON cash_flows(department_id, biz_date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_site_date ON cash_flows(site_id, biz_date);

-- 借款相关索引优化
CREATE INDEX IF NOT EXISTS idx_borrowings_user_currency ON borrowings(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_created_at ON borrowings(created_at);
CREATE INDEX IF NOT EXISTS idx_repayments_borrowing_id ON repayments(borrowing_id);

-- 请假相关索引优化
CREATE INDEX IF NOT EXISTS idx_employee_leaves_emp_status_date ON employee_leaves(employee_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status_date ON employee_leaves(status, start_date, end_date);

-- 报销相关索引优化
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_emp_status ON expense_reimbursements(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_status ON expense_reimbursements(status);

-- AR/AP 相关索引优化
CREATE INDEX IF NOT EXISTS idx_settlements_doc_id ON settlements(doc_id);
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_status ON ar_ap_docs(status);
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_issue_date ON ar_ap_docs(issue_date);
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_party_id ON ar_ap_docs(party_id);

-- 员工薪资相关索引优化
CREATE INDEX IF NOT EXISTS idx_employee_salaries_emp_id ON employee_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_allowances_emp_id ON employee_allowances(employee_id);

-- 固定资产相关索引优化
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_dept ON fixed_assets(department_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_allocations_asset ON fixed_asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_allocations_emp ON fixed_asset_allocations(employee_id);

-- 站点相关索引优化
CREATE INDEX IF NOT EXISTS idx_sites_department_id ON sites(department_id);
