import { z } from 'zod'
import dayjs from 'dayjs'

export const createARSchema = z.object({
    siteId: z.string().min(1, '请选择站点'),
    issueDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的开立日期'),
    dueDate: z.any().optional().refine((val) => !val || dayjs(val).isValid(), '请选择有效的到期日'),
    amount: z.number().min(0.01, '金额必须大于0'),
    memo: z.string().optional(),
})

export type CreateARFormData = z.infer<typeof createARSchema>

export const confirmARSchema = z.object({
    accountId: z.string().min(1, '请选择账户'),
    categoryId: z.string().min(1, '请选择类别'),
    bizDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的业务日期'),
    memo: z.string().optional(),
    voucherUrl: z.string().min(1, '请上传凭证'),
})

export type ConfirmARFormData = z.infer<typeof confirmARSchema>

export const settleARSchema = z.object({
    flowId: z.string().min(1, '请选择流水'),
    settle_amount: z.number().min(0.01, '核销金额必须大于0'),
})

export type SettleARFormData = z.infer<typeof settleARSchema>
