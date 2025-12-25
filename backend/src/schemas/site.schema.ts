/**
 * 站点相关 Schema 定义
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 创建站点Schema
 */
export const createSiteSchema = z.object({
    departmentId: uuidSchema,
    name: z.string().min(1, 'name参数必填'),
    siteCode: z.string().optional(),
})

/**
 * 更新站点Schema
 */
export const updateSiteSchema = z.object({
    name: z.string().min(1).optional(),
    departmentId: uuidSchema.optional(),
    active: z.number().int().min(0).max(1).optional(),
    siteCode: z.string().optional(),
})

/**
 * 创建站点账单Schema
 */
export const createSiteBillSchema = z.object({
    siteId: uuidSchema,
    billDate: dateSchema,
    billType: z.enum(['income', 'expense'], {
        errorMap: () => ({ message: 'billType必须为income或expense' }),
    }),
    amountCents: z.number().int().positive('amountCents必须大于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    description: z.string().optional(),
    accountId: uuidSchema.optional(),
    categoryId: uuidSchema.optional(),
    status: z.string().optional(),
    paymentDate: dateSchema.optional(),
    memo: z.string().optional(),
})

/**
 * 更新站点账单Schema
 */
export const updateSiteBillSchema = z.object({
    billDate: dateSchema.optional(),
    billType: z.enum(['income', 'expense']).optional(),
    amountCents: z.number().int().positive().optional(),
    currency: z.string().length(3).optional(),
    description: z.string().optional(),
    accountId: uuidSchema.optional(),
    categoryId: uuidSchema.optional(),
    status: z.string().optional(),
    paymentDate: dateSchema.optional(),
    memo: z.string().optional(),
})

/**
 * 站点配置Schema
 */
export const updateSiteConfigSchema = z.object({
    configValue: z.string().min(1, 'configValue必须是字符串'),
})

/**
 * 批量更新站点配置Schema
 */
export const batchUpdateSiteConfigSchema = z.record(z.string(), z.string())
