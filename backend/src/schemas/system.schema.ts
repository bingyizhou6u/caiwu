/**
 * 系统相关 Schema 定义 (职位、IP白名单、系统配置等)
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 创建职位Schema
 */
export const createPositionSchema = z.object({
    code: z.string().min(1, 'code参数必填'),
    name: z.string().min(1, 'name参数必填'),
    permissions: z.any(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
})

/**
 * 更新职位Schema
 */
export const updatePositionSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    canManageSubordinates: z.number().int().min(0).max(1).optional(),
    dataScope: z.enum(['all', 'project', 'group', 'self']).optional(),
    permissions: z.any().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    active: z.number().int().min(0).max(1).optional(),
})

/**
 * IP白名单Schema
 */
export const createIPWhitelistSchema = z.object({
    ipAddress: z.string().min(1, 'ipAddress参数必填'),
    description: z.string().optional(),
})

/**
 * 批量创建IP白名单Schema
 */
export const batchCreateIPWhitelistSchema = z.object({
    ips: z
        .array(
            z.object({
                ip: z.string().min(1, 'ip地址不能为空'),
                description: z.string().optional(),
            })
        )
        .min(1, 'ips数组必填且不能为空'),
})

/**
 * 批量删除IP白名单Schema
 */
export const batchDeleteIPWhitelistSchema = z.object({
    ids: z.array(uuidSchema).min(1, 'ids数组必填且不能为空'),
})

/**
 * 切换IP白名单规则Schema
 */
export const toggleIPWhitelistRuleSchema = z.object({
    enabled: z.boolean(),
})

/**
 * 系统配置Schema
 */
export const updateSystemConfigSchema = z.object({
    value: z.any(),
    description: z.string().optional(),
})

/**
 * 查询参数Schema - 日期范围
 */
export const dateRangeQuerySchema = z.object({
    start: dateSchema,
    end: dateSchema,
})

/**
 * 查询参数Schema - ID参数
 */
export const idQuerySchema = z.object({
    docId: uuidSchema.optional(),
    employeeId: uuidSchema.optional(),
    accountId: uuidSchema.optional(),
    departmentId: uuidSchema.optional(),
})

/**
 * 上传凭证Schema（用于文件上传验证）
 */
export const uploadVoucherSchema = z.object({
    file: z
        .instanceof(File, { message: '文件必填' })
        .refine(file => file.size > 0, { message: '文件不能为空' })
        .refine(file => file.size <= 10 * 1024 * 1024, { message: '文件过大（最大10MB）' })
        .refine(file => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type), {
            message: '只允许上传图片格式（JPEG、PNG、GIF、WebP）',
        })
        .refine(file => file.type === 'image/webp', {
            message: '请在前端将图片转换为WebP格式后上传',
        }),
})
