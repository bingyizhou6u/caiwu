import { z } from 'zod'
import dayjs from 'dayjs'

export const createFlowSchema = z.object({
    bizDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的日期'),
    voucher_no: z.string().optional(),
    // owner_scope 由外部状态控制，不在表单 schema 中
    projectId: z.string().optional(),
    siteId: z.string().optional(),
    type: z.string().min(1, '请选择类型'),
    amount: z.number().min(0.01, '金额必须大于0'),
    accountId: z.string().min(1, '请选择账户'),
    categoryId: z.string().min(1, '请选择类别'),
    counterparty: z.string().optional(),
    memo: z.string().optional(),
    voucherUrls: z.array(z.string()).min(1, '请至少上传一张凭证'),
})

export type CreateFlowFormData = z.infer<typeof createFlowSchema>
