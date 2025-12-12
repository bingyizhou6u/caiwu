-- ==================== 索引优化迁移 ====================
-- 创建时间: 2025-12-08
-- 说明：为外键和常用查询字段添加索引
-- ==================== ==================== ====================

-- 员工表索引
CREATE INDEX IF NOT EXISTS idx_employees_position_id ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- 会话/设备索引
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);

-- 固定资产索引
CREATE INDEX IF NOT EXISTS idx_fixed_assets_department_id ON fixed_assets(department_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_allocations_asset_id ON fixed_asset_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_allocations_employee_id ON fixed_asset_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_changes_asset_id ON fixed_asset_changes(asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_depreciations_asset_id ON fixed_asset_depreciations(asset_id);

-- 租赁相关索引
CREATE INDEX IF NOT EXISTS idx_rental_properties_department_id ON rental_properties(department_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_property_id ON rental_payments(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_changes_property_id ON rental_changes(property_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_allocations_property_id ON dormitory_allocations(property_id);
CREATE INDEX IF NOT EXISTS idx_dormitory_allocations_employee_id ON dormitory_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_rental_payable_bills_property_id ON rental_payable_bills(property_id);
CREATE INDEX IF NOT EXISTS idx_rental_payable_bills_status ON rental_payable_bills(status);

-- 资金流水索引
CREATE INDEX IF NOT EXISTS idx_cash_flows_biz_date ON cash_flows(biz_date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_account_id ON cash_flows(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_department_id ON cash_flows(department_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_created_by ON cash_flows(created_by);
CREATE INDEX IF NOT EXISTS idx_cash_flows_category_id ON cash_flows(category_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_site_id ON cash_flows(site_id);

-- 借款/还款索引
CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_borrower_id ON borrowings(borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_repayments_borrowing_id ON repayments(borrowing_id);

-- 薪资相关索引
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee_id ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON salary_payments(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_year_month ON salary_payments(year, month);
CREATE INDEX IF NOT EXISTS idx_salary_payment_allocations_salary_payment_id ON salary_payment_allocations(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee_id ON employee_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_allowances_employee_id ON employee_allowances(employee_id);
CREATE INDEX IF NOT EXISTS idx_allowance_payments_employee_id ON allowance_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_allowance_payments_year_month ON allowance_payments(year, month);

-- 请假/报销索引
CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee_id ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status ON employee_leaves(status);
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_employee_id ON expense_reimbursements(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_status ON expense_reimbursements(status);

-- 考勤索引
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_date ON attendance_records(employee_id, date);

-- 账户交易索引
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_flow_id ON account_transactions(flow_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_transaction_date ON account_transactions(transaction_date);

-- 站点账单索引
CREATE INDEX IF NOT EXISTS idx_site_bills_site_id ON site_bills(site_id);
CREATE INDEX IF NOT EXISTS idx_site_bills_status ON site_bills(status);

-- AR/AP 索引
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_kind ON ar_ap_docs(kind);
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_department_id ON ar_ap_docs(department_id);
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_status ON ar_ap_docs(status);
CREATE INDEX IF NOT EXISTS idx_settlements_doc_id ON settlements(doc_id);

-- 站点索引
CREATE INDEX IF NOT EXISTS idx_sites_department_id ON sites(department_id);

-- 期初余额索引
CREATE INDEX IF NOT EXISTS idx_opening_balances_ref_id ON opening_balances(ref_id);
