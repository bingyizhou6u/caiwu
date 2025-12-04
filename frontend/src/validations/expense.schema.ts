import { z } from 'zod'
import dayjs from 'dayjs'

export const expenseSchema = z.object({
    employee_id: z.string().min(1, '请选择员工'),
    expense_type: z.string().min(1, '请选择报销类型'),
    amount: z.number().min(0.01, '金额必须大于0'),
    expense_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的日期'),
    description: z.string().min(1, '请输入报销说明'),
    currency_id: z.string().min(1, '请选择币种'),
    voucher_url: z.string().optional(), // 凭证URL可能在提交前上传，或者在提交时上传，这里先设为可选，逻辑层校验
    memo: z.string().optional(),
})

export const approveExpenseSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    account_id: z.string().optional(),
    category_id: z.string().optional(),
    memo: z.string().optional(),
}).refine((data) => {
    if (data.status === 'approved') {
        return !!data.account_id && !!data.category_id
    }
    return true
}, {
    message: '批准时必须选择支出账户和类别',
    path: ['account_id'], // 错误显示在 account_id 上，也可以是 category_id
})
