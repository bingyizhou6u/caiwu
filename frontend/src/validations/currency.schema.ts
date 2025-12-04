import { z } from 'zod'

export const currencySchema = z.object({
    code: z.string()
        .min(1, '币种代码不能为空')
        .max(8, '币种代码过长')
        .regex(/^[A-Z]+$/, '币种代码必须是大写字母'),
    name: z.string().min(1, '币种名称不能为空').max(50, '币种名称过长'),
    active: z.boolean().optional(),
})

export type CurrencyFormData = z.infer<typeof currencySchema>
