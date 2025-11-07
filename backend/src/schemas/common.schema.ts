/**
 * 通用Schema定义
 */

import { z } from 'zod'

/**
 * UUID验证
 */
export const uuidSchema = z.string().uuid('ID格式不正确')

/**
 * 日期格式验证 (YYYY-MM-DD)
 */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为YYYY-MM-DD')

/**
 * 邮箱验证
 */
export const emailSchema = z.string().email('邮箱格式不正确')

/**
 * 分页参数
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

/**
 * 排序参数
 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/**
 * 日期查询参数Schema
 */
export const dateQuerySchema = z.object({
  date: dateSchema,
})

/**
 * ID查询参数Schema
 */
export const idQuerySchema = z.object({
  doc_id: uuidSchema.optional(),
  id: uuidSchema.optional(),
  employee_id: uuidSchema.optional(),
  account_id: uuidSchema.optional(),
  department_id: uuidSchema.optional(),
})

/**
 * 必需的doc_id查询Schema
 */
export const docIdQuerySchema = z.object({
  doc_id: uuidSchema,
})

/**
 * 日期范围查询Schema
 */
export const dateRangeQuerySchema = z.object({
  start: dateSchema,
  end: dateSchema,
})

/**
 * 单个日期查询Schema
 */
export const singleDateQuerySchema = z.object({
  as_of: dateSchema,
})

/**
 * AR/AP汇总查询Schema
 */
export const arApSummaryQuerySchema = dateRangeQuerySchema.extend({
  kind: z.enum(['AR', 'AP']),
})

/**
 * AR/AP明细查询Schema（日期可选）
 */
export const arApDetailQuerySchema = z.object({
  start: dateSchema.optional(),
  end: dateSchema.optional(),
})

/**
 * 薪资报表查询Schema
 */
export const salaryReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
})

/**
 * CSV导入查询Schema
 */
export const csvImportQuerySchema = z.object({
  kind: z.enum(['flows', 'AR', 'AP', 'opening']),
})

/**
 * 固定资产查询Schema
 */
export const fixedAssetQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
  department_id: uuidSchema.optional(),
  category: z.string().optional(),
})

/**
 * 固定资产分配查询Schema
 */
export const fixedAssetAllocationQuerySchema = z.object({
  asset_id: uuidSchema.optional(),
  employee_id: uuidSchema.optional(),
  returned: z.enum(['true', 'false']).optional(),
})

/**
 * 租赁房屋查询Schema
 */
export const rentalPropertyQuerySchema = z.object({
  property_type: z.enum(['office', 'warehouse', 'dormitory', 'other']).optional(),
  status: z.string().optional(),
  department_id: uuidSchema.optional(),
})

/**
 * 薪资发放查询Schema
 */
export const salaryPaymentQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.string().optional(),
  employee_id: uuidSchema.optional(),
})

/**
 * 员工查询Schema
 */
export const employeeQuerySchema = z.object({
  status: z.enum(['all', 'regular', 'probation', 'resigned']).optional(),
  active_only: z.enum(['true', 'false']).optional(),
  employee_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})

/**
 * 借款查询Schema
 */
export const borrowingQuerySchema = z.object({
  user_id: uuidSchema.optional(),
})

/**
 * 还款查询Schema
 */
export const repaymentQuerySchema = z.object({
  borrowing_id: uuidSchema.optional(),
})

/**
 * 员工请假查询Schema
 */
export const employeeLeaveQuerySchema = z.object({
  employee_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})

/**
 * 员工报销查询Schema
 */
export const expenseReimbursementQuerySchema = z.object({
  employee_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  status: z.string().optional(),
})

/**
 * 账户转账查询Schema
 */
export const accountTransferQuerySchema = z.object({
  from_account_id: uuidSchema.optional(),
  to_account_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})

/**
 * 审计日志查询Schema
 */
export const auditLogQuerySchema = paginationSchema

/**
 * 站点账单查询Schema
 */
export const siteBillQuerySchema = z.object({
  site_id: uuidSchema.optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
  bill_type: z.string().optional(),
  status: z.string().optional(),
})

/**
 * 创建/更新通用字段
 */
export const timestampsSchema = z.object({
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
})

/**
 * ID路径参数Schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
})

/**
 * 基础实体Schema
 */
export const baseEntitySchema = z.object({
  id: uuidSchema,
  active: z.number().int().min(0).max(1).optional(),
}).merge(timestampsSchema)

