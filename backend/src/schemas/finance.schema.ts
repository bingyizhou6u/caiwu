/**
 * 财务相关 Schema 定义
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 创建现金流Schema
 */
export const createCashFlowSchema = z.object({
    accountId: uuidSchema,
    categoryId: uuidSchema,
    bizDate: dateSchema,
    type: z.enum(['income', 'expense', 'borrowing_in', 'lending_out', 'repayment_in', 'repayment_out'], {
        errorMap: () => ({ message: 'type必须为有效的记账类型' }),
    }),
    amountCents: z.number().int().positive('amountCents必须大于0'),
    voucherUrls: z.array(z.string().url('凭证URL格式不正确')).min(1, 'voucherUrls参数必填（凭证上传是必填的）'),
    voucherNo: z.string().optional(),
    method: z.string().optional(),
    siteId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    counterparty: z.string().optional(),
    memo: z.string().optional(),
    createdBy: uuidSchema.optional(),
})

/**
 * 创建账户Schema
 */
export const createAccountSchema = z.object({
    name: z.string().min(1, 'name参数必填'),
    type: z.string().min(1, 'type参数必填'),
    currency: z.string().length(3, 'currency必须是3位币种代码').optional(),
    alias: z.string().optional(),
    accountNumber: z.string().optional(),
    openingCents: z.number().int().optional(),
})

/**
 * 更新账户Schema
 */
export const updateAccountSchema = z.object({
    name: z.string().min(1).optional(),
    type: z.string().optional(),
    currency: z.string().length(3).optional(),
    alias: z.string().optional(),
    accountNumber: z.string().optional(),
    active: z.number().int().min(0).max(1).optional(),
})

/**
 * 创建AR/AP文档Schema
 */
export const createArApDocSchema = z.object({
    kind: z.enum(['AR', 'AP'], { errorMap: () => ({ message: 'kind必须为AR或AP' }) }),
    partyId: uuidSchema.optional(),
    siteId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    issueDate: dateSchema.optional(),
    dueDate: dateSchema.optional(),
    amountCents: z.number().int().positive('amountCents必须大于0'),
    docNo: z.string().optional(),
    memo: z.string().optional(),
})

/**
 * 创建结算Schema
 */
export const createSettlementSchema = z.object({
    docId: uuidSchema,
    flowId: uuidSchema,
    settleAmountCents: z.number().int().positive('settleAmountCents必须大于0'),
    settleDate: dateSchema.optional(),
})

/**
 * 确认AR/AP文档Schema
 */
export const confirmArApDocSchema = z.object({
    docId: uuidSchema,
    accountId: uuidSchema,
    categoryId: uuidSchema,
    bizDate: dateSchema,
    voucherUrl: z.string().url('voucherUrl参数必填（凭证上传是必填的）'),
    method: z.string().optional(),
    memo: z.string().optional(),
    createdBy: uuidSchema.optional(),
})

/**
 * 创建借款Schema
 */
export const createBorrowingSchema = z.object({
    userId: uuidSchema,
    accountId: uuidSchema,
    amount: z.number().positive('金额必须大于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    borrowDate: dateSchema,
    memo: z.string().optional(),
})

/**
 * 创建还款Schema
 */
export const createRepaymentSchema = z.object({
    borrowingId: uuidSchema,
    accountId: uuidSchema,
    amount: z.number().positive('金额必须大于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    repayDate: dateSchema,
    memo: z.string().optional(),
})

/**
 * 创建账户转账Schema
 */
export const createAccountTransferSchema = z
    .object({
        transferDate: dateSchema,
        fromAccountId: uuidSchema,
        toAccountId: uuidSchema,
        fromAmountCents: z.number().int().positive('转出金额必须大于0'),
        toAmountCents: z.number().int().positive('转入金额必须大于0'),
        exchangeRate: z.number().positive().optional(),
        memo: z.string().optional(),
        voucherUrl: z.string().url().optional(),
    })
    .refine(data => data.fromAccountId !== data.toAccountId, {
        message: '转出账户和转入账户不能相同',
        path: ['toAccountId'],
    })

/**
 * 创建币种Schema
 */
export const createCurrencySchema = z.object({
    code: z
        .string()
        .min(1, 'code参数必填')
        .transform(val => val.trim().toUpperCase()),
    name: z.string().min(1, 'name参数必填'),
})

/**
 * 更新币种Schema
 */
export const updateCurrencySchema = z
    .object({
        name: z.string().optional(),
        active: z.boolean().optional(),
    })
    .refine(data => data.name !== undefined || data.active !== undefined, {
        message: '没有需要更新的字段',
    })

/**
 * 创建类别Schema
 */
export const createCategorySchema = z.object({
    name: z.string().min(1, 'name参数必填'),
    kind: z.enum(['income', 'expense'], {
        errorMap: () => ({ message: 'kind必须为income或expense' }),
    }),
    parentId: uuidSchema.optional().nullable(),
})

/**
 * 更新类别Schema
 */
export const updateCategorySchema = z
    .object({
        name: z.string().optional(),
        kind: z.enum(['income', 'expense']).optional(),
    })
    .refine(data => data.name !== undefined || data.kind !== undefined, {
        message: '没有需要更新的字段',
    })
