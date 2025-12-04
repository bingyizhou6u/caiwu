/**
 * API响应类型定义 - 扩展版
 * 补充各个API端点的特定响应类型
 */

import type { ID } from './common'

// ============= 报表相关扩展 =============

/**
 * 账户余额汇总
 */
export interface AccountBalanceSummary {
    rows: Array<{
        account_id: ID
        account_name: string
        account_type: string
        currency: string
        opening_cents: number
        income_cents: number
        expense_cents: number
        closing_cents: number
    }>
}

/**
 * 借款汇总
 */
export interface BorrowingSummary {
    user_id: ID
    borrower_name: string
    borrower_email?: string
    currency: string
    total_borrowed_cents: number
    total_repaid_cents: number
    balance_cents: number
}

/**
 * 借款汇总列表响应
 */
export interface BorrowingSummaryResponse {
    results: BorrowingSummary[]
}

/**
 * 借款人明细
 */
export interface BorrowerDetail {
    user: {
        id: ID
        name: string
        email?: string
    }
    borrowings: Array<{
        id: ID
        amount_cents: number
        currency: string
        borrow_date: string
        memo?: string
        account_name?: string
    }>
    repayments: Array<{
        id: ID
        borrowing_id: ID
        amount_cents: number
        currency: string
        repay_date: string
        memo?: string
        account_name?: string
    }>
}

/**
 * 员工薪资行
 */
export interface EmployeeSalaryRow {
    employee_id: ID
    employee_name: string
    department_id: ID
    department_name?: string
    year: number
    month: number
    join_date: string
    status: 'probation' | 'regular'
    regular_date?: string
    base_salary_cents: number
    work_days: number
    days_in_month: number
    leave_days?: number
    actual_salary_cents: number
}

/**
 * 员工薪资列表响应
 */
export interface EmployeeSalaryResponse {
    results: EmployeeSalaryRow[]
}

/**
 * 审计日志
 */
export interface AuditLog {
    id: ID
    at: number
    actor_name?: string
    actor_email?: string
    action: string
    entity: string
    entity_id?: ID
    detail?: string
    ip?: string
    ip_location?: string
}

/**
 * 审计日志列表响应
 */
export interface AuditLogsResponse {
    results: AuditLog[]
    total: number
}

// ============= 通用响应包装 =============

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
    success: boolean
    successCount: number
    failedCount: number
    synced?: number
    errors?: Array<{
        id?: ID
        error: string
    }>
}
