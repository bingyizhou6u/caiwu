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
  active: z.number().int().min(0).max(1).default(1),
})

export const createHeadquartersSchema = headquartersSchema.omit({ id: true })
export const updateHeadquartersSchema = createHeadquartersSchema.partial()

/**
 * 部门Schema
 */
export const departmentSchema = z.object({
  id: uuidSchema,
  hq_id: uuidSchema.optional().nullable(),
  name: z.string().min(1, '名称不能为空'),
  active: z.number().int().min(0).max(1).default(1),
})

export const createDepartmentSchema = departmentSchema.omit({ id: true })
export const updateDepartmentSchema = createDepartmentSchema.partial()

/**
 * 站点Schema
 */
export const siteSchema = z.object({
  id: uuidSchema,
  department_id: uuidSchema,
  name: z.string().min(1, '名称不能为空'),
  site_code: z.string().optional().nullable(),
  theme_style: z.string().optional().nullable(),
  theme_color: z.string().optional().nullable(),
  frontend_url: z.string().optional().nullable(),
  active: z.number().int().min(0).max(1).default(1),
})

export const createSiteSchema = siteSchema.omit({ id: true })
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
  account_number: z.string().optional().nullable(),
  opening_cents: z.number().int().min(0).default(0),
  active: z.number().int().min(0).max(1).default(1),
})

export const createAccountSchema = accountSchema.omit({ id: true })
export const updateAccountSchema = createAccountSchema.partial()

/**
 * 类别Schema
 */
export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '类别名称不能为空'),
  kind: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: '类别类型必须为income或expense' })
  }),
  parent_id: uuidSchema.optional().nullable(),
})

export const createCategorySchema = categorySchema.omit({ id: true })
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
  active: z.number().int().min(0).max(1).default(1),
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
  active: z.number().int().min(0).max(1).default(1),
})

export const createVendorSchema = vendorSchema.omit({ id: true })
export const updateVendorSchema = createVendorSchema.partial()

/**
 * 账户交易记录Schema
 */
export const accountTransactionSchema = z.object({
  id: uuidSchema,
  transaction_date: z.string(),
  transaction_type: z.string(),
  amount_cents: z.number().int(),
  balance_before_cents: z.number().int(),
  balance_after_cents: z.number().int(),
  created_at: z.number().int(),
  voucher_no: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  counterparty: z.string().optional().nullable(),
  voucher_url: z.string().optional().nullable(),
  category_name: z.string().optional().nullable(),
})

/**
 * 职位Schema
 */
export const positionSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1, '职位代码不能为空'),
  name: z.string().min(1, '职位名称不能为空'),
  level: z.number().int().min(1).max(3),
  function_role: z.string().min(1, '职能角色不能为空'),
  can_manage_subordinates: z.number().int().min(0).max(1).default(0),
  description: z.string().optional().nullable(),
  permissions: z.string().optional().nullable(), // JSON string
  sort_order: z.number().int().default(0),
  active: z.number().int().min(0).max(1).default(1),
})

/**
 * 组织部门Schema
 */
export const orgDepartmentSchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema.optional().nullable(),
  parent_id: uuidSchema.optional().nullable(),
  name: z.string().min(1, '部门名称不能为空'),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  allowed_modules: z.string().optional().nullable(), // JSON string
  allowed_positions: z.string().optional().nullable(), // JSON string
  default_position_id: uuidSchema.optional().nullable(),
  active: z.number().int().min(0).max(1).default(1),
  sort_order: z.number().int().default(0),
})

export const availablePositionsResponseSchema = z.object({
  results: z.array(positionSchema),
  grouped: z.record(z.array(positionSchema)),
  department_info: z.object({
    project_id: z.string().nullable(),
    project_name: z.string().nullable(),
    department_id: z.string(),
    department_name: z.string(),
    is_hq: z.boolean()
  })
})
