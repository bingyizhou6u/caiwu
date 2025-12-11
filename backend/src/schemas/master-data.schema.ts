/**
 * 主数据相关Schema
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 总部Schema
 */
export const headquartersSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '名称不能为空'),
  active: z.number().int().min(0).max(1).nullable().default(1),
})

export const createHeadquartersSchema = headquartersSchema.omit({ id: true })
export const updateHeadquartersSchema = createHeadquartersSchema.partial()

/**
 * 部门Schema
 */
export const departmentSchema = z.object({
  id: uuidSchema,
  hqId: uuidSchema.optional().nullable(),
  name: z.string().min(1, '名称不能为空'),
  active: z.number().int().min(0).max(1).nullable().default(1),
})

export const createDepartmentSchema = departmentSchema.omit({ id: true })
export const updateDepartmentSchema = createDepartmentSchema.partial()

/**
 * 站点Schema
 */
export const siteSchema = z.object({
  id: uuidSchema,
  departmentId: uuidSchema,
  name: z.string().min(1, '名称不能为空'),
  siteCode: z.string().optional().nullable(),
  themeStyle: z.string().optional().nullable(),
  themeColor: z.string().optional().nullable(),
  frontendUrl: z.string().optional().nullable(),
  active: z.number().int().min(0).max(1).nullable().default(1),
  departmentName: z.string().optional().nullable(),
})

export const createSiteSchema = siteSchema.omit({ id: true, departmentName: true })
export const updateSiteSchema = createSiteSchema.partial()

/**
 * 账户Schema
 */
export const accountSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '账户名称不能为空'),
  type: z.enum(['cash', 'bank', 'alipay', 'wechat', 'other'], {
    errorMap: () => ({ message: '账户类型不正确' })
  }),
  currency: z.string().length(3, '币种代码必须为3位'),
  alias: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  openingCents: z.number().int().min(0).nullable().default(0),
  active: z.number().int().min(0).max(1).nullable().default(1),
})

export const createAccountSchema = accountSchema.omit({ id: true })
export const updateAccountSchema = createAccountSchema.partial()

/**
 * 类别Schema
 */
export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '类别名称不能为空'),
  kind: z.string(),
  parentId: uuidSchema.optional().nullable(),
  sortOrder: z.number().int().nullable().optional(),
  active: z.number().int().min(0).max(1).nullable().optional(),
})

export const createCategorySchema = categorySchema.omit({ id: true, sortOrder: true, active: true })
export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(['income', 'expense']).optional(),
})

/**
 * 币种Schema
 */
export const currencySchema = z.object({
  code: z.string().length(3, '币种代码必须为3位'),
  name: z.string().min(1, '币种名称不能为空'),
  symbol: z.string().optional().nullable(),
  active: z.number().int().min(0).max(1).nullable().default(1),
})

export const createCurrencySchema = currencySchema
export const updateCurrencySchema = currencySchema.partial().omit({ code: true })

/**
 * 供应商Schema
 */
export const vendorSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '名称不能为空'),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('邮箱格式不正确').optional().nullable(),
  address: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  active: z.number().int().min(0).max(1).nullable().default(1),
})

export const createVendorSchema = vendorSchema.omit({ id: true })
export const updateVendorSchema = createVendorSchema.partial()

/**
 * 账户交易记录Schema
 */
export const accountTransactionSchema = z.object({
  id: uuidSchema,
  transactionDate: z.string(),
  transactionType: z.string(),
  amountCents: z.number().int(),
  balanceBeforeCents: z.number().int(),
  balanceAfterCents: z.number().int(),
  createdAt: z.number().int(),
  voucherNo: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  counterparty: z.string().optional().nullable(),
  voucherUrl: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
})

/**
 * 职位Schema
 */
export const positionSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1, '职位代码不能为空'),
  name: z.string().min(1, '职位名称不能为空'),
  level: z.number().int().min(1).max(3),
  functionRole: z.string().min(1, '职能角色不能为空'),
  canManageSubordinates: z.number().int().min(0).max(1).nullable().default(0),
  description: z.string().optional().nullable(),
  permissions: z.string().optional().nullable(), // JSON string
  sortOrder: z.number().int().nullable().default(0),
  active: z.number().int().min(0).max(1).nullable().default(1),
  createdAt: z.number().int().nullable().optional(),
  updatedAt: z.number().int().nullable().optional(),
})

/**
 * 组织部门Schema
 */
export const orgDepartmentSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema.optional().nullable(),
  parentId: uuidSchema.optional().nullable(),
  name: z.string().min(1, '部门名称不能为空'),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  allowedModules: z.string().optional().nullable(), // JSON string
  allowedPositions: z.string().optional().nullable(), // JSON string
  defaultPositionId: uuidSchema.optional().nullable(),
  active: z.number().int().min(0).max(1).default(1),
  sortOrder: z.number().int().default(0),
})

export const availablePositionsResponseSchema = z.object({
  results: z.array(positionSchema),
  grouped: z.record(z.array(positionSchema)),
  departmentInfo: z.object({
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    departmentId: z.string(),
    departmentName: z.string(),
    isHq: z.boolean()
  })
})
