/**
 * 通用类型定义
 * 包含系统中通用的基础类型和工具类型
 */

// ============= 基础类型别名 =============

/** ID类型 - 统一使用string */
export type ID = string

/** 时间戳 - Unix毫秒时间戳 */
export type Timestamp = number

/** 金额（分） - 统一使用整数表示金额（分） */
export type AmountCents = number

// ============= 通用接口 =============

/**
 * 下拉选项
 * 用于Select组件等
 */
export interface SelectOption<V = string> {
    value: V
    label: string
    disabled?: boolean
    [key: string]: any
}

/**
 * 分页响应
 * 用于列表API的统一响应格式
 */
export interface PaginatedResponse<T> {
    results: T[]
    total: number
    offset?: number
    limit?: number
}

/**
 * API统一响应格式
 * 包装API返回的数据
 */
export interface ApiResponse<T = any> {
    data?: T
    success?: boolean
    message?: string
    errors?: ApiError[]
}

/**
 * API错误
 */
export interface ApiError {
    code?: string
    message: string
    field?: string
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
    offset?: number
    limit?: number
    page?: number
    pageSize?: number
}

/**
 * 排序参数
 */
export interface SortParams {
    sortBy?: string
    sortOrder?: 'asc' | 'desc' | 'ascend' | 'descend'
}

/**
 * 通用查询参数
 */
export interface QueryParams extends PaginationParams, SortParams {
    search?: string
    filters?: Record<string, any>
}

// ============= 枚举值类型 =============

/** 状态 - 启用/停用 */
export type ActiveStatus = 0 | 1

/** 通用状态 */
export type Status = 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'

/** 币种代码 */
export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'JPY' | 'GBP' | string

// ============= 工具类型 =============

/**
 * 将接口所有字段变为可选
 */
export type Partial<T> = {
    [P in keyof T]?: T[P]
}

/**
 * 将接口所有字段变为必填
 */
export type Required<T> = {
    [P in keyof T]-?: T[P]
}

/**
 * 选择接口的部分字段
 */
export type Pick<T, K extends keyof T> = {
    [P in K]: T[P]
}

/**
 * 排除接口的部分字段
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
