import { z } from 'zod'
import dayjs from 'dayjs'

export const createAPSchema = z.object({
    party: z.string().min(1, '请输入供应商名称'),
    issue_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的开立日期'),
    due_date: z.any().optional().refine((val) => !val || dayjs(val).isValid(), '请选择有效的到期日'),
    amount: z.number().min(0.01, '金额必须大于0'),
    memo: z.string().optional(),
})

export type CreateAPFormData = z.infer<typeof createAPSchema>

export const confirmAPSchema = z.object({
    account_id: z.string().min(1, '请选择账户'),
    category_id: z.string().min(1, '请选择类别'),
    biz_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的业务日期'),
    memo: z.string().optional(),
    voucher_url: z.string().min(1, '请上传凭证'),
})

export type ConfirmAPFormData = z.infer<typeof confirmAPSchema>
