-- ==================== 数据完整性验证 ====================
-- 创建时间: 2025-12-08
-- 说明：检查数据完整性，查找孤儿记录
-- ==================== ==================== ====================

-- 1. 检查孤儿员工（无效的 position_id）
SELECT 'orphan_employees_position' AS check_type, e.id, e.name, e.position_id 
FROM employees e 
LEFT JOIN positions p ON e.position_id = p.id 
WHERE e.position_id IS NOT NULL AND p.id IS NULL;

-- 2. 检查孤儿员工（无效的 department_id）
SELECT 'orphan_employees_department' AS check_type, e.id, e.name, e.department_id 
FROM employees e 
LEFT JOIN departments d ON e.department_id = d.id 
WHERE e.department_id IS NOT NULL AND d.id IS NULL;

-- 3. 检查孤儿资金流水（无效的 account_id）
SELECT 'orphan_cash_flows' AS check_type, cf.id, cf.voucher_no, cf.account_id 
FROM cash_flows cf 
LEFT JOIN accounts a ON cf.account_id = a.id 
WHERE a.id IS NULL;

-- 4. 检查孤儿固定资产分配（无效的 asset_id）
SELECT 'orphan_asset_allocations' AS check_type, fa.id, fa.asset_id, fa.employee_id
FROM fixed_asset_allocations fa 
LEFT JOIN fixed_assets f ON fa.asset_id = f.id 
WHERE f.id IS NULL;

-- 5. 检查孤儿租赁付款（无效的 property_id）
SELECT 'orphan_rental_payments' AS check_type, rp.id, rp.property_id, rp.payment_date
FROM rental_payments rp 
LEFT JOIN rental_properties r ON rp.property_id = r.id 
WHERE r.id IS NULL;

-- 6. 检查孤儿借款（无效的 user_id）
SELECT 'orphan_borrowings' AS check_type, b.id, b.user_id, b.amount_cents
FROM borrowings b 
LEFT JOIN users u ON b.user_id = u.id 
WHERE u.id IS NULL;

-- 7. 检查孤儿还款（无效的 borrowing_id）
SELECT 'orphan_repayments' AS check_type, r.id, r.borrowing_id, r.amount_cents
FROM repayments r 
LEFT JOIN borrowings b ON r.borrowing_id = b.id 
WHERE b.id IS NULL;

-- 8. 统计索引情况
SELECT 'index_count' AS check_type, COUNT(*) AS count 
FROM sqlite_master 
WHERE type = 'index' AND name LIKE 'idx_%';
