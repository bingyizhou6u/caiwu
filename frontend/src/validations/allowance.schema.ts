import { z } from 'zod'
import dayjs from 'dayjs'

export const allowancePaymentSchema = z.object({
    employee_id: z.string().min(1, '请选择员工'),
    year: z.number().min(2000, '年份无效'),
    month: z.number().min(1, '月份无效').max(12, '月份无效'),
    allowance_type: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
    currency_id: z.string().min(1, '请选择币种'),
    amount: z.number().min(0.01, '金额必须大于0'),
    payment_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的发放日期'),
    payment_method: z.enum(['cash', 'transfer']),
    memo: z.string().optional(),
})

export const allowancePaymentUpdateSchema = z.object({
    payment_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的发放日期'),
    payment_method: z.enum(['cash', 'transfer']),
    voucher_url: z.string().optional(),
    memo: z.string().optional(),
})

export const allowancePaymentGenerateSchema = z.object({
    year: z.number().min(2000, '年份无效'),
    month: z.number().min(1, '月份无效').max(12, '月份无效'),
    payment_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的发放日期'),
})
