/**
 * 类型定义入口
 * 统一导出所有类型定义
 */

// 通用类型
export * from './common'

// 业务实体 (优先使用，覆盖schema中的定义)
export * from './domain'

// API响应
export * from './responses'

// DTOs
export * from './dtos'

// 从现有文件导出（避免冲突）
export type { RentalProperty, RentalPayableBill, DormitoryAllocation, SelectOption as RentalSelectOption } from './rental'
// OpenAPI Schema
export * from './schema-helpers'
