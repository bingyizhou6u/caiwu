import { z } from 'zod'
import { amountSchema } from './common.schema'

export const accountSchema = z.object({
    name: z.string().min(1, '账户名称不能为空'),

    accountNumber: z.string().optional(),

    currency: z.string().min(1, '请选择币种'),

    type: z.enum(['cash', 'bank', 'credit_card', 'other']),

    alias: z.string().optional(),

    initialBalanceCents: amountSchema
        .transform(val => Math.round(val * 100))
        .optional(),

    bank_name: z.string().optional(),

    manager: z.string().optional(),

    active: z.boolean().optional(),

    description: z.string().max(500, '描述过长').optional(),
})

export type AccountFormData = z.infer<typeof accountSchema>
