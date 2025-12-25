/**
 * API响应类型定义 - 扩展版
 * 补充各个API端点的特定响应类型
 */

import type { ID } from './common'

// ============= 通用列表响应 =============

/**
 * 通用列表响应类型
 * 适用于所有返回 { results: T[] } 格式的 API
 */
export interface ListResponse<T> {
    results: T[]
    total?: number
}

// ============= 报表相关扩展 =============

/**
 * 账户余额汇总
 */
export interface AccountBalanceSummary {
    rows: Array<{
        accountId: ID
        accountName: string
        accountType: string
        currency: string
        openingCents: number
        incomeCents: number
        expenseCents: number
        closingCents: number
    }>
}

/**
 * 借款汇总
 */
export interface BorrowingSummary {
    userId: ID
    borrowerName: string
    borrowerEmail?: string
    currency: string
    totalBorrowedCents: number
    totalRepaidCents: number
    balanceCents: number
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
        amountCents: number
        currency: string
        borrowDate: string
        memo?: string
        accountName?: string
    }>
    repayments: Array<{
        id: ID
        borrowingId: ID
        amountCents: number
        currency: string
        repayDate: string
        memo?: string
        accountName?: string
    }>
}

/**
 * 员工薪资行
 */
export interface EmployeeSalaryRow {
    employeeId: ID
    employeeName: string
    departmentId: ID
    departmentName?: string
    year: number
    month: number
    joinDate: string
    status: 'probation' | 'regular'
    regularDate?: string
    baseSalaryCents: number
    workDays: number
    daysInMonth: number
    leaveDays?: number
    actualSalaryCents: number
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
    actorName?: string
    actorEmail?: string
    action: string
    entity: string
    entityId?: ID
    detail?: string
    ip?: string
    ipLocation?: string
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
