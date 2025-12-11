import { z } from 'zod'

export const salaryPaymentGenerateSchema = z.object({
    year: z.number().min(2000, '年份无效'),
    month: z.number().min(1).max(12, '月份无效'),
})

export const salaryPaymentTransferSchema = z.object({
    accountId: z.string().min(1, '请选择转账账户'),
})

export const salaryPaymentAllocationSchema = z.object({
    allocations: z.array(z.object({
        currencyId: z.string().min(1, '请选择币种'),
        amountCents: z.number().min(0, '金额必须大于等于0'),
        accountId: z.string().optional(),
    })).min(1, '请至少添加一种币种分配'),
})

export const salaryPaymentConfirmSchema = z.object({
    payment_voucher_path: z.string().min(1, '请上传转账凭证'),
})
