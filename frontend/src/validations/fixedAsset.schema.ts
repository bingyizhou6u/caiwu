import { z } from 'zod'

export const createFixedAssetSchema = z.object({
    assetCode: z.string().min(1, '请输入资产编号'),
    name: z.string().min(1, '请输入资产名称'),
    category: z.string().optional(),
    purchaseDate: z.any().optional(), // dayjs object
    purchasePriceCents: z.number().min(0, '金额不能为负数'),
    currency: z.string().min(1, '请选择币种'),
    vendorId: z.string().optional(),
    departmentId: z.string().optional(),
    siteId: z.string().optional(),
    custodian: z.string().optional(),
    status: z.enum(['in_use', 'idle', 'scrapped', 'maintenance']),
    depreciation_method: z.string().optional(),
    useful_life_years: z.number().min(0).optional(),
    currentValueCents: z.number().min(0).optional(),
    memo: z.string().optional(),
})

export type CreateFixedAssetFormData = z.infer<typeof createFixedAssetSchema>

export const updateFixedAssetSchema = createFixedAssetSchema

export type UpdateFixedAssetFormData = z.infer<typeof updateFixedAssetSchema>

export const transferFixedAssetSchema = z.object({
    transfer_date: z.any(), // dayjs object
    to_departmentId: z.string().optional(),
    to_siteId: z.string().optional(),
    to_custodian: z.string().optional(),
    memo: z.string().optional(),
})

export type TransferFixedAssetFormData = z.infer<typeof transferFixedAssetSchema>

export const depreciateFixedAssetSchema = z.object({
    depreciation_date: z.any(), // dayjs object
    depreciation_amountCents: z.number().min(0, '金额不能为负数'),
    memo: z.string().optional(),
})

export type DepreciateFixedAssetFormData = z.infer<typeof depreciateFixedAssetSchema>
