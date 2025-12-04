import { z } from 'zod'
import dayjs from 'dayjs'

export const createBorrowingSchema = z.object({
    user_id: z.string().min(1, '请选择借款人'),
    currency: z.string().min(1, '请选择币种'),
    account_id: z.string().min(1, '请选择资金账户'),
    amount: z.number().min(0.01, '借款金额必须大于0'),
    borrow_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的借款日期'),
    memo: z.string().optional(),
})

export type CreateBorrowingFormData = z.infer<typeof createBorrowingSchema>
