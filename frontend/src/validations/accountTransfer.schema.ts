import { z } from 'zod'
import dayjs from 'dayjs'

export const createAccountTransferSchema = z.object({
    transferDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的转账日期'),
    fromAccountId: z.string().min(1, '请选择转出账户'),
    toAccountId: z.string().min(1, '请选择转入账户'),
    fromAmount: z.number().min(0.01, '转出金额必须大于0'),
    toAmount: z.number().min(0.01, '转入金额必须大于0'),
    exchangeRate: z.number().optional(),
    memo: z.string().optional(),
    voucherUrls: z.array(z.string()).min(1, '请至少上传一张凭证'), // Note: Component uses voucherUrls array for upload but API might take single url or array? 
    // Checking AccountTransfer.tsx: body: { ... voucherUrl: voucherUrls[0] }
    // So the form data has voucherUrls (array), but the API payload uses voucherUrl (string).
    // I will keep the schema matching the form data structure.
})

export type CreateAccountTransferFormData = z.infer<typeof createAccountTransferSchema>
