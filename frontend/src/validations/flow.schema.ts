import { z } from 'zod'
import dayjs from 'dayjs'

export const createFlowSchema = z.object({
    bizDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的日期'),
    voucher_no: z.string().optional(),
    // owner is handled by state, not form field directly usually, but let's see.
    // In Flows.tsx, owner is a radio group outside the form or controlled state?
    // It's a Radio.Group but not in Form.Item? No, it IS in Form.Item label="归属".
    // Wait, <Form.Item label="归属"> <Radio.Group ... value={owner} onChange={...} /> </Form.Item>
    // It seems it's controlled by `owner` state, not form field name.
    // But let's check if we can make it part of the form.
    // The payload uses `owner_scope: owner`.
    // I will exclude it from schema if it's external state, or include it if I refactor to use form field.
    // Refactoring to use form field is better.
    // But for now, let's stick to the form fields that are actually inside <Form.Item name="...">.

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
