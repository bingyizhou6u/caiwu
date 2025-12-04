import { z } from 'zod'
import dayjs from 'dayjs'

export const createAccountTransferSchema = z.object({
    transfer_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的转账日期'),
    from_account_id: z.string().min(1, '请选择转出账户'),
    to_account_id: z.string().min(1, '请选择转入账户'),
    from_amount: z.number().min(0.01, '转出金额必须大于0'),
    to_amount: z.number().min(0.01, '转入金额必须大于0'),
    exchange_rate: z.number().optional(),
    memo: z.string().optional(),
    voucher_urls: z.array(z.string()).min(1, '请至少上传一张凭证'), // Note: Component uses voucher_urls array for upload but API might take single url or array? 
    // Checking AccountTransfer.tsx: body: { ... voucher_url: voucherUrls[0] }
    // So the form data has voucher_urls (array), but the API payload uses voucher_url (string).
    // I will keep the schema matching the form data structure.
})

export type CreateAccountTransferFormData = z.infer<typeof createAccountTransferSchema>
