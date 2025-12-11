import { z } from 'zod'
import dayjs from 'dayjs'

export const expenseSchema = z.object({
    employeeId: z.string().min(1, '请选择员工'),
    expenseType: z.string().min(1, '请选择报销类型'),
    amount: z.number().min(0.01, '金额必须大于0'),
    expenseDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的日期'),
    description: z.string().min(1, '请输入报销说明'),
    currencyId: z.string().min(1, '请选择币种'),
    voucherUrl: z.string().optional(), // 凭证URL可能在提交前上传，或者在提交时上传，这里先设为可选，逻辑层校验
    memo: z.string().optional(),
})

export const approveExpenseSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    memo: z.string().optional(),
}).refine((data) => {
    if (data.status === 'approved') {
        return !!data.accountId && !!data.categoryId
    }
    return true
}, {
    message: '批准时必须选择支出账户和类别',
    path: ['accountId'], // 错误显示在 accountId 上，也可以是 categoryId
})
