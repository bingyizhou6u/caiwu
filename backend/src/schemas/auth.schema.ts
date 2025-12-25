/**
 * 认证相关 Schema 定义
 */

import { z } from '@hono/zod-openapi'
import { emailSchema } from './common.schema.js'

/**
 * 登录Schema
 */
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'password参数必填'),
    totp: z.string().optional(),
})

/**
 * 修改密码Schema
 */
export const changePasswordSchema = z.object({
    email: emailSchema,
    oldPassword: z.string().optional(),
    newPassword: z.string().min(6, '密码长度至少6位'),
    totpCode: z.string().length(6, 'TOTP验证码必须为6位').optional(),
})

/**
 * 重置密码Schema
 */
export const resetPasswordSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'password参数必填'),
})

/**
 * 绑定TOTP Schema
 */
export const bindTotpSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'password参数必填'),
    secret: z.string().min(1, 'secret参数必填'),
    totp: z.string().min(1, 'totp参数必填'),
})
