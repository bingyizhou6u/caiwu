/**
 * 主数据相关Schema
 */

import { z } from 'zod'
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

