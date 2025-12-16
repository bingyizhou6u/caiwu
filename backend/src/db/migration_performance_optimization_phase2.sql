-- ==================== 第二阶段性能优化索引 ====================
-- 创建时间: 2025-12-15
-- 说明：为常用查询模式添加复合索引，优化查询性能
-- ==================== ==================== ====================

-- 1. 员工表复合索引（用于权限过滤和列表查询）
-- 常用查询：按部门、状态、活跃度过滤
CREATE INDEX IF NOT EXISTS idx_employees_dept_status_active 
    ON employees(department_id, status, active);

-- 常用查询：按组织部门、状态过滤
CREATE INDEX IF NOT EXISTS idx_employees_org_dept_status 
    ON employees(org_department_id, status);

-- 常用查询：按职位、状态过滤
CREATE INDEX IF NOT EXISTS idx_employees_position_status 
    ON employees(position_id, status);

-- 2. 现金流复合索引（用于报表和统计查询）
-- 常用查询：按账户、日期范围查询
CREATE INDEX IF NOT EXISTS idx_cash_flows_account_date 
    ON cash_flows(account_id, biz_date DESC);

-- 常用查询：按部门、日期范围查询
CREATE INDEX IF NOT EXISTS idx_cash_flows_dept_date 
    ON cash_flows(department_id, biz_date DESC);

-- 常用查询：按站点、日期范围查询
CREATE INDEX IF NOT EXISTS idx_cash_flows_site_date 
    ON cash_flows(site_id, biz_date DESC);

-- 常用查询：按类别、日期范围查询
CREATE INDEX IF NOT EXISTS idx_cash_flows_category_date 
    ON cash_flows(category_id, biz_date DESC);

-- 常用查询：按类型、日期范围查询（收入/支出统计）
CREATE INDEX IF NOT EXISTS idx_cash_flows_type_date 
    ON cash_flows(type, biz_date DESC);

-- 3. 薪资支付复合索引（用于薪资查询和统计）
-- 常用查询：按员工、年月查询
CREATE INDEX IF NOT EXISTS idx_salary_payments_emp_year_month 
    ON salary_payments(employee_id, year DESC, month DESC);

-- 常用查询：按状态、年月查询（用于批量处理）
CREATE INDEX IF NOT EXISTS idx_salary_payments_status_year_month 
    ON salary_payments(status, year DESC, month DESC);

-- 4. 借款复合索引（用于借款查询和统计）
-- 常用查询：按用户、状态查询
CREATE INDEX IF NOT EXISTS idx_borrowings_user_status 
    ON borrowings(user_id, status);

-- 常用查询：按借款人、状态查询
CREATE INDEX IF NOT EXISTS idx_borrowings_borrower_status 
    ON borrowings(borrower_id, status);

-- 5. 请假复合索引（用于请假查询和统计）
-- 常用查询：按员工、状态、日期范围查询
CREATE INDEX IF NOT EXISTS idx_employee_leaves_emp_status_date 
    ON employee_leaves(employee_id, status, start_date DESC);

-- 常用查询：按状态、日期范围查询（用于审批）
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status_date 
    ON employee_leaves(status, start_date DESC, end_date DESC);

-- 6. 报销复合索引（用于报销查询和统计）
-- 常用查询：按员工、状态查询
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_emp_status 
    ON expense_reimbursements(employee_id, status);

-- 常用查询：按状态、日期查询（用于审批）
CREATE INDEX IF NOT EXISTS idx_expense_reimbursements_status_date 
    ON expense_reimbursements(status, expense_date DESC);

-- 7. AR/AP 单据复合索引（用于应收应付查询）
-- 常用查询：按类型、状态查询
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_kind_status 
    ON ar_ap_docs(kind, status);

-- 常用查询：按部门、状态查询
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_dept_status 
    ON ar_ap_docs(department_id, status);

-- 常用查询：按日期范围查询
CREATE INDEX IF NOT EXISTS idx_ar_ap_docs_issue_date 
    ON ar_ap_docs(issue_date DESC);

-- 8. 账户交易复合索引（用于账户余额查询）
-- 常用查询：按账户、交易日期查询
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_date 
    ON account_transactions(account_id, transaction_date DESC);

-- 9. 考勤记录复合索引（用于考勤查询和统计）
-- 常用查询：按员工、日期查询（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_attendance_records_emp_date 
    ON attendance_records(employee_id, date DESC);

-- 10. 审计日志复合索引（用于审计查询）
-- 常用查询：按用户、操作类型、时间查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action_date 
    ON audit_logs(actor_id, action, at DESC);

-- 常用查询：按实体类型、实体ID查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id 
    ON audit_logs(entity_type, entity_id);

-- 11. 补贴支付复合索引（用于补贴查询和统计）
-- 常用查询：按员工、年月查询
CREATE INDEX IF NOT EXISTS idx_allowance_payments_emp_year_month 
    ON allowance_payments(employee_id, year DESC, month DESC);

-- 12. 站点账单复合索引（用于站点账单查询）
-- 常用查询：按站点、状态查询
CREATE INDEX IF NOT EXISTS idx_site_bills_site_status 
    ON site_bills(site_id, status);

-- 13. 固定资产复合索引（用于资产查询）
-- 常用查询：按部门、状态查询
CREATE INDEX IF NOT EXISTS idx_fixed_assets_dept_status 
    ON fixed_assets(department_id, status);

-- 14. 租赁物业复合索引（用于租赁查询）
-- 常用查询：按部门、状态查询
CREATE INDEX IF NOT EXISTS idx_rental_properties_dept_status 
    ON rental_properties(department_id, status);

-- 15. 组织部门复合索引（用于组织架构查询）
-- 常用查询：按项目、父级查询（已存在，但确保存在）
CREATE INDEX IF NOT EXISTS idx_org_departments_project_parent 
    ON org_departments(project_id, parent_id);

