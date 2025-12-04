import { z } from 'zod'
import dayjs from 'dayjs'

export const createARSchema = z.object({
    site_id: z.string().min(1, '请选择站点'),
    issue_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的开立日期'),
    due_date: z.any().optional().refine((val) => !val || dayjs(val).isValid(), '请选择有效的到期日'),
    amount: z.number().min(0.01, '金额必须大于0'),
    memo: z.string().optional(),
})

export type CreateARFormData = z.infer<typeof createARSchema>

export const confirmARSchema = z.object({
    account_id: z.string().min(1, '请选择账户'),
    category_id: z.string().min(1, '请选择类别'),
    biz_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的业务日期'),
    memo: z.string().optional(),
    voucher_url: z.string().min(1, '请上传凭证'),
})

export type ConfirmARFormData = z.infer<typeof confirmARSchema>

export const settleARSchema = z.object({
    flow_id: z.string().min(1, '请选择流水'),
    settle_amount: z.number().min(0.01, '核销金额必须大于0'),
})

export type SettleARFormData = z.infer<typeof settleARSchema>
