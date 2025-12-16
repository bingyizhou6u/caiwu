import { z } from 'zod'
import dayjs from 'dayjs'

export const createAPSchema = z.object({
    partyId: z.string().min(1, '请选择供应商'),
    issueDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的开立日期'),
    dueDate: z.any().optional().refine((val) => !val || dayjs(val).isValid(), '请选择有效的到期日'),
    amount: z.number().min(0.01, '金额必须大于0'),
    memo: z.string().optional(),
})

export type CreateAPFormData = z.infer<typeof createAPSchema>

export const confirmAPSchema = z.object({
    accountId: z.string().min(1, '请选择账户'),
    categoryId: z.string().min(1, '请选择类别'),
    bizDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的业务日期'),
    memo: z.string().optional(),
    voucherUrl: z.string().min(1, '请上传凭证'),
})

export type ConfirmAPFormData = z.infer<typeof confirmAPSchema>
