import { z } from 'zod'
import dayjs from 'dayjs'

export const createRepaymentSchema = z.object({
    borrowing_id: z.string().min(1, '请选择借款记录'),
    currency: z.string().min(1, '请选择币种'),
    accountId: z.string().min(1, '请选择资金账户'),
    amount: z.number().min(0.01, '还款金额必须大于0'),
    repay_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的还款日期'),
    memo: z.string().optional(),
})

export type CreateRepaymentFormData = z.infer<typeof createRepaymentSchema>
