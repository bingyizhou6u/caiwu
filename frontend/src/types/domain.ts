/**
 * 业务实体类型定义
 * 包含系统中所有核心业务实体的类型定义
 */

import type { ID, Timestamp, AmountCents, ActiveStatus, CurrencyCode } from './common'

// ============= 用户和权限 =============

/**
 * 用户
 */
export interface User {
    id: ID
    email: string
    name: string
    role: 'read' | 'write' | 'manage'
    active: ActiveStatus
    employee_id?: ID
    department_ids?: ID[]
    totp_enabled?: boolean
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 职位
 */
export interface Position {
    id: ID
    code: string
    name: string
    level: number
    function_role?: string
    can_manage_subordinates?: 0 | 1
    permissions?: PermissionConfig
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 权限配置
 */
export interface PermissionConfig {
    [module: string]: {
        [subModule: string]: string[]  // actions: ['view', 'create', 'update', 'delete']
    }
}

// ============= 员工 =============

/**
 * 员工
 */
export interface Employee {
    id: ID
    name: string
    email: string
    phone_number?: string
    phone?: string
    id_number?: string
    join_date: string
    status: 'probation' | 'regular' | 'resigned'
    regular_date?: string
    resign_date?: string

    // 离职信息
    leave_date?: string
    leave_reason?: string
    leave_type?: 'resigned' | 'terminated' | 'expired' | 'retired' | 'other'
    leave_memo?: string

    // 部门和组织
    department_id: ID
    department_name?: string
    org_department_id?: ID
    org_department_name?: string
    org_department_code?: string

    // 职位信息
    position_id?: ID
    position?: Position
    position_code?: string
    position_name?: string
    position_level?: number  // 职位层级 (1-总部 2-项目 3-组)


    // 薪资信息
    base_salary_cents?: AmountCents
    probation_salary_cents?: AmountCents
    regular_salary_cents?: AmountCents

    // 津贴
    living_allowance_cents?: AmountCents
    housing_allowance_cents?: AmountCents
    transportation_allowance_cents?: AmountCents
    meal_allowance_cents?: AmountCents

    // 个人信息
    birthday?: string  // YYYY-MM-DD
    usdt_address?: string
    emergency_contact?: string
    emergency_phone?: string
    address?: string
    memo?: string

    // 工作安排
    work_schedule?: {
        days: number[]
        start: string
        end: string
    }
    annual_leave_cycle_months?: number
    annual_leave_days?: number

    // 用户账号信息
    user_id?: ID
    user_role?: string
    user_active?: number
    user_last_login_at?: Timestamp

    // 状态
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

// ============= 组织架构 =============

/**
 * 项目/部门
 */
export interface Department {
    id: ID
    name: string
    code?: string
    parent_id?: ID
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 站点
 */
export interface Site {
    id: ID
    name: string
    code?: string
    location?: string
    // Extended fields from API
    department_id?: ID
    site_code?: string
    theme_style?: string
    theme_color?: string
    frontend_url?: string
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

// ============= 财务核心 =============

/**
 * 账户
 */
export interface Account {
    id: ID
    name: string
    alias?: string
    account_number?: string
    currency: CurrencyCode
    currency_name?: string  // Join from currency table
    account_type: 'cash' | 'bank' | 'credit_card' | 'other'
    type?: 'cash' | 'bank' | 'credit_card' | 'other'  // Alias for account_type
    balance_cents: AmountCents
    manager?: string  // Manager name
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 币种
 */
export interface Currency {
    id: ID
    code: CurrencyCode
    name: string
    symbol?: string
    active: ActiveStatus
    exchange_rate?: number
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 类别（收入/支出）
 */
export interface Category {
    id: ID
    name: string
    kind: 'income' | 'expense'
    code?: string
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 现金流
 */
export interface CashFlow {
    id: ID
    voucher_no: string
    type: 'income' | 'expense'
    amount_cents: AmountCents
    currency: CurrencyCode
    transaction_date: string
    account_id: ID
    account_name?: string
    category_id?: ID
    category_name?: string
    department_id?: ID
    department_name?: string
    employee_id?: ID
    employee_name?: string
    counterparty?: string
    memo?: string
    voucher_url?: string
    created_by?: ID
    created_at?: Timestamp
    updated_at?: Timestamp
}

// ============= 供应商和客户 =============

/**
 * 供应商
 */
export interface Vendor {
    id: ID
    name: string
    code?: string
    contact?: string  // Contact information (simplified from multiple fields)
    contact_person?: string
    contact_phone?: string
    contact_email?: string
    address?: string
    active: ActiveStatus
    created_at?: Timestamp
    updated_at?: Timestamp
}

// ============= 资产管理 =============

/**
 * 固定资产
 */
export interface FixedAsset {
    id: ID
    asset_code: string
    name: string
    category?: string
    purchase_date?: string
    purchase_price_cents?: AmountCents
    currency?: CurrencyCode
    vendor_id?: ID
    vendor_name?: string
    site_id?: ID
    site_name?: string
    status: 'idle' | 'in_use' | 'maintenance' | 'sold' | 'scrapped'
    memo?: string
    // 折旧相关
    current_value_cents?: AmountCents
    useful_life_years?: number
    depreciation_method?: string
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 固定资产分配
 */
export interface FixedAssetAllocation {
    id: ID
    asset_id: ID
    asset_code?: string
    asset_name?: string
    employee_id: ID
    employee_name?: string
    allocation_type: 'employee_onboarding' | 'transfer' | 'temporary'
    allocation_date: string
    return_date?: string
    memo?: string
    created_at?: Timestamp
    updated_at?: Timestamp
}

// ============= 薪资和借款 =============

/**
 * 薪资发放
 */
export interface SalaryPayment {
    id: ID
    employee_id: ID
    employee_name?: string
    year: number
    month: number
    base_salary_cents: AmountCents
    actual_salary_cents: AmountCents
    work_days: number
    days_in_month: number
    leave_days?: number
    currency: CurrencyCode
    status: 'pending' | 'paid'
    pay_date?: string
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 借款记录
 */
export interface Borrowing {
    id: ID
    user_id: ID
    user_name?: string
    // Extended fields from API join
    borrower_name?: string
    borrower_email?: string
    amount_cents: AmountCents
    currency: CurrencyCode
    borrow_date: string
    account_id?: ID
    account_name?: string
    memo?: string
    created_by?: ID
    creator_name?: string
    created_at?: Timestamp
    updated_at?: Timestamp
}

/**
 * 还款记录
 */
export interface Repayment {
    id: ID
    borrowing_id: ID
    user_id: ID
    // Extended fields from API join
    borrower_name?: string
    borrower_email?: string
    amount_cents: AmountCents
    currency: CurrencyCode
    repay_date: string
    account_id?: ID
    account_name?: string
    memo?: string
    created_by?: ID
    creator_name?: string
    created_at?: Timestamp
    updated_at?: Timestamp
}
