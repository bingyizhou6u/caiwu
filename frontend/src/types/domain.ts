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
    employeeId?: ID
    departmentIds?: ID[]
    totpEnabled?: boolean
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

/**
 * 职位
 */
export interface Position {
    id: ID
    code: string
    name: string
    level: number
    functionRole?: string
    canManageSubordinates?: 0 | 1
    dataScope?: 'all' | 'project' | 'group' | 'self'
    permissions?: PermissionConfig
    createdAt?: Timestamp
    updatedAt?: Timestamp
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
    personalEmail: string
    phoneNumber?: string
    phone?: string
    id_number?: string
    joinDate: string
    status: 'probation' | 'regular' | 'resigned'
    regularDate?: string
    resign_date?: string

    // 离职信息
    leaveDate?: string
    leave_reason?: string
    leave_type?: 'resigned' | 'terminated' | 'expired' | 'retired' | 'other'
    leave_memo?: string

    // 部门和组织
    departmentId: ID
    departmentName?: string
    orgDepartmentId?: ID
    orgDepartmentName?: string
    orgDepartmentCode?: string

    // 职位信息
    positionId?: ID
    position?: Position
    positionCode?: string
    positionName?: string
    positionLevel?: number  // 职位层级 (1-总部 2-项目 3-组)

    // Salary/allowance data (joined from latest config)
    probationSalaryCents?: AmountCents
    regularSalaryCents?: AmountCents
    livingAllowanceCents?: AmountCents
    housingAllowanceCents?: AmountCents
    transportationAllowanceCents?: AmountCents
    mealAllowanceCents?: AmountCents
    birthdayAllowanceCents?: AmountCents

    // 个人信息
    birthday?: string  // YYYY-MM-DD
    usdtAddress?: string
    emergencyContact?: string
    emergencyPhone?: string
    address?: string
    memo?: string

    // 工作安排
    workSchedule?: {
        days: number[]
        start: string
        end: string
    }
    annualLeaveCycleMonths?: number
    annualLeaveDays?: number

    // 用户账号信息
    userId?: ID
    userRole?: string
    userActive?: number
    userLastLoginAt?: Timestamp
    isActivated?: boolean
    totpEnabled?: boolean

    // 状态
    active: ActiveStatus
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

// ============= 组织架构 =============

/**
 * 项目/部门
 */
export interface Department {
    id: ID
    name: string
    code?: string
    parentId?: ID
    active: ActiveStatus
    sortOrder?: number
    createdAt?: Timestamp
    updatedAt?: Timestamp
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
    departmentId?: ID
    siteCode?: string
    themeStyle?: string
    themeColor?: string
    frontendUrl?: string
    active: ActiveStatus
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

// ============= 财务核心 =============

/**
 * 账户
 */
export interface Account {
    id: ID
    name: string
    alias?: string
    accountNumber?: string
    currency: CurrencyCode
    currencyName?: string  // Join from currency table
    accountType: 'cash' | 'bank' | 'credit_card' | 'other'
    type?: 'cash' | 'bank' | 'credit_card' | 'other'  // Alias for accountType
    balanceCents: AmountCents
    manager?: string  // Manager name
    active: ActiveStatus
    createdAt?: Timestamp
    updatedAt?: Timestamp
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
    exchangeRate?: number
    createdAt?: Timestamp
    updatedAt?: Timestamp
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
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

/**
 * 现金流
 */
export interface CashFlow {
    id: ID
    voucherNo: string
    type: 'income' | 'expense'
    amountCents: AmountCents
    currency: CurrencyCode
    transactionDate: string
    accountId: ID
    accountName?: string
    categoryId?: ID
    categoryName?: string
    departmentId?: ID
    departmentName?: string
    employeeId?: ID
    employeeName?: string
    counterparty?: string
    memo?: string
    voucherUrl?: string
    createdBy?: ID
    createdAt?: Timestamp
    updatedAt?: Timestamp
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
    contactPerson?: string
    contactPhone?: string
    contactEmail?: string
    address?: string
    active: ActiveStatus
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

// ============= 资产管理 =============

/**
 * 固定资产
 */
export interface FixedAsset {
    id: ID
    assetCode: string
    name: string
    category?: string
    purchaseDate?: string
    purchasePriceCents?: AmountCents
    currency?: CurrencyCode
    vendorId?: ID
    vendorName?: string
    siteId?: ID
    siteName?: string
    departmentId?: ID
    departmentName?: string
    custodian?: string
    status: 'idle' | 'in_use' | 'maintenance' | 'sold' | 'scrapped'
    memo?: string
    // 折旧相关
    currentValueCents?: AmountCents
    usefulLifeYears?: number
    depreciationMethod?: string
    createdByName?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

/**
 * 固定资产分配
 */
export interface FixedAssetAllocation {
    id: ID
    assetId: ID
    assetCode?: string
    assetName?: string
    employeeId: ID
    employeeName?: string
    allocationType: 'employee_onboarding' | 'transfer' | 'temporary'
    allocationDate: string
    returnDate?: string
    memo?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

// ============= 薪资和借款 =============

/**
 * 薪资发放
 */
export interface SalaryPayment {
    id: ID
    employeeId: ID
    employeeName?: string
    year: number
    month: number
    baseSalaryCents: AmountCents
    actualSalaryCents: AmountCents
    work_days: number
    days_in_month: number
    leave_days?: number
    currency: CurrencyCode
    status: 'pending' | 'paid'
    pay_date?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

/**
 * 借款记录
 */
export interface Borrowing {
    id: ID
    userId: ID
    userName?: string
    // Extended fields from API join
    borrowerName?: string
    borrowerEmail?: string
    amountCents: AmountCents
    currency: CurrencyCode
    borrow_date: string
    accountId?: ID
    accountName?: string
    memo?: string
    createdBy?: ID
    creator_name?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
}

/**
 * 还款记录
 */
export interface Repayment {
    id: ID
    borrowing_id: ID
    userId: ID
    // Extended fields from API join
    borrowerName?: string
    borrowerEmail?: string
    amountCents: AmountCents
    currency: CurrencyCode
    repay_date: string
    accountId?: ID
    accountName?: string
    memo?: string
    createdBy?: ID
    creator_name?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
}
