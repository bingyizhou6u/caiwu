import { z } from 'zod'

// 通用验证规则
export const idSchema = z.string().min(1, 'ID不能为空')

export const emailSchema = z
    .string()
    .email('邮箱格式不正确')
    .or(z.literal(''))  // 允许空值

export const phoneSchema = z
    .string()
    .regex(/^\+\d{1,4}\d{7,15}$/, '手机号格式不正确：需要包含国家代码，如+971xxxxxxxx')

export const amountSchema = z
    .number()
    .positive('金额必须大于0')
    .finite('金额必须是有效数字')

export const dateSchema = z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    '日期格式不正确，应为YYYY-MM-DD'
)
