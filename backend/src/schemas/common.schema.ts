/**
 * 通用Schema定义 - camelCase
 */

import { z } from '@hono/zod-openapi'

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
  pageSize: z.coerce.number().int().min(1).max(1000).optional(), // 增加到 1000 以支持大量数据查询
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
  docId: uuidSchema.optional(),
  id: uuidSchema.optional(),
  employeeId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
})

/**
 * 必需的docId查询Schema
 */
export const docIdQuerySchema = z.object({
  docId: uuidSchema,
})

/**
 * 日期范围查询Schema
 */
export const dateRangeQuerySchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
  })
  .refine(data => data.start <= data.end, {
    message: '开始日期不能晚于结束日期',
    path: ['end'],
  })

/**
 * 单个日期查询Schema
 */
export const singleDateQuerySchema = z.object({
  asOf: dateSchema,
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
  projectId: uuidSchema.optional(),
  category: z.string().optional(),
})

/**
 * 固定资产分配查询Schema
 */
export const fixedAssetAllocationQuerySchema = z.object({
  assetId: uuidSchema.optional(),
  employeeId: uuidSchema.optional(),
  returned: z.enum(['true', 'false']).optional(),
})

/**
 * 租赁房屋查询Schema
 */
export const rentalPropertyQuerySchema = z.object({
  propertyType: z.enum(['office', 'warehouse', 'dormitory', 'other']).optional(),
  status: z.string().optional(),
  projectId: uuidSchema.optional(),
})

/**
 * 薪资发放查询Schema
 */
export const salaryPaymentQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.string().optional(),
  employeeId: uuidSchema.optional(),
})

/**
 * 员工查询Schema
 */
export const employeeQuerySchema = z.object({
  status: z.enum(['all', 'regular', 'probation', 'resigned']).optional(),
  activeOnly: z.enum(['true', 'false']).optional(),
  employeeId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
})

/**
 * 借款查询Schema
 */
export const borrowingQuerySchema = z.object({
  userId: uuidSchema.optional(),
})

/**
 * 还款查询Schema
 */
export const repaymentQuerySchema = z.object({
  borrowingId: uuidSchema.optional(),
})

/**
 * 员工请假查询Schema
 */
export const employeeLeaveQuerySchema = z.object({
  employeeId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
})

/**
 * 员工报销查询Schema
 */
export const expenseReimbursementQuerySchema = z.object({
  employeeId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: z.string().optional(),
})

/**
 * 账户转账查询Schema
 */
export const accountTransferQuerySchema = z.object({
  fromAccountId: uuidSchema.optional(),
  toAccountId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
})

/**
 * 审计日志查询Schema
 */
export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  entity: z.string().optional(),
  actorId: uuidSchema.optional(),
  actorKeyword: z.string().optional(),
  startTime: z.coerce.number().int().optional(),
  endTime: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

/**
 * 站点账单查询Schema
 */
export const siteBillQuerySchema = z.object({
  siteId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  billType: z.string().optional(),
  status: z.string().optional(),
})

/**
 * ID路径参数Schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
})

/**
 * 租赁应付账单查询Schema
 */
export const rentalPayableBillQuerySchema = z.object({
  propertyId: uuidSchema.optional(),
  status: z.string().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
})
