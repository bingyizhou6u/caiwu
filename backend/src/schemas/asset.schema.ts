/**
 * 固定资产相关 Schema 定义
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 创建固定资产Schema
 */
export const createFixedAssetSchema = z.object({
    assetCode: z.string().min(1, 'assetCode参数必填'),
    name: z.string().min(1, 'name参数必填'),
    category: z.string().optional(),
    purchaseDate: dateSchema.optional(),
    purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    projectId: uuidSchema.optional(),
    siteId: uuidSchema.optional(),
    vendorId: uuidSchema.optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
    currentValueCents: z.number().int().nonnegative().optional(),
    depreciationMethod: z.string().optional(),
    usefulLifeYears: z.number().int().positive().optional(),
    memo: z.string().optional(),
})

/**
 * 更新固定资产Schema
 */
export const updateFixedAssetSchema = z.object({
    name: z.string().min(1).optional(),
    category: z.string().optional(),
    purchaseDate: dateSchema.optional(),
    purchasePriceCents: z.number().int().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    projectId: uuidSchema.optional(),
    siteId: uuidSchema.optional(),
    vendorId: uuidSchema.optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(['in_use', 'idle', 'maintenance', 'scrapped']).optional(),
    memo: z.string().optional(),
})

/**
 * 分配固定资产Schema
 */
export const allocateFixedAssetSchema = z.object({
    assetId: uuidSchema,
    employeeId: uuidSchema,
    allocationDate: dateSchema,
    allocationType: z.enum(['employee_onboarding', 'transfer', 'temporary']).optional(),
    expectedReturnDate: dateSchema.optional(),
    memo: z.string().optional(),
})

/**
 * 创建固定资产折旧Schema
 */
export const createDepreciationSchema = z.object({
    assetId: uuidSchema,
    depreciationDate: dateSchema,
    amountCents: z.number().int().positive('折旧金额必须大于0'),
    memo: z.string().optional(),
})

/**
 * 固定资产转移Schema
 */
export const transferFixedAssetSchema = z.object({
    toProjectId: uuidSchema.optional(),
    toSiteId: uuidSchema.optional(),
    toCustodian: z.string().optional(),
    transferDate: dateSchema,
    memo: z.string().optional(),
})

/**
 * 固定资产购买Schema
 */
export const purchaseFixedAssetSchema = z.object({
    assetCode: z.string().min(1, 'assetCode参数必填'),
    name: z.string().min(1, 'name参数必填'),
    category: z.string().optional(),
    purchaseDate: dateSchema,
    purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    accountId: uuidSchema,
    vendorId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    siteId: uuidSchema.optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    memo: z.string().optional(),
})

/**
 * 固定资产出售Schema
 */
export const sellFixedAssetSchema = z.object({
    saleDate: dateSchema,
    salePriceCents: z.number().int().positive('salePriceCents必须大于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    accountId: uuidSchema,
    categoryId: uuidSchema,
    voucherUrl: z.string().url().optional(),
    saleBuyer: z.string().optional(),
    saleMemo: z.string().optional(),
    memo: z.string().optional(),
})

/**
 * 资产归还Schema
 */
export const returnFixedAssetSchema = z.object({
    returnDate: dateSchema,
    returnType: z.enum(['employee_resignation', 'transfer', 'expired', 'other']).optional(),
    memo: z.string().optional(),
})

/**
 * 固定资产购买Schema（包含流水相关字段）
 */
export const purchaseFixedAssetWithFlowSchema = z.object({
    assetCode: z.string().min(1, 'assetCode参数必填'),
    name: z.string().min(1, 'name参数必填'),
    category: z.string().optional(),
    purchaseDate: dateSchema,
    purchasePriceCents: z.number().int().nonnegative('purchasePriceCents必须大于等于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    accountId: uuidSchema,
    categoryId: uuidSchema,
    vendorId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    siteId: uuidSchema.optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    memo: z.string().optional(),
    voucherUrl: z.string().url().optional(),
    depreciationMethod: z.string().optional(),
    usefulLifeYears: z.number().int().positive().optional(),
})

// Response Schemas
export const fixedAssetResponseSchema = z.object({
    id: z.string(),
    assetCode: z.string(),
    name: z.string(),
    category: z.string().nullable(),
    purchaseDate: z.string().nullable(),
    purchasePriceCents: z.number(),
    currency: z.string(),
    vendorId: z.string().nullable(),
    projectId: z.string().nullable(),
    siteId: z.string().nullable(),
    custodian: z.string().nullable(),
    status: z.string().nullable(),
    depreciationMethod: z.string().nullable(),
    usefulLifeYears: z.number().nullable(),
    currentValueCents: z.number().nullable(),
    memo: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
    departmentName: z.string().nullable(),
    siteName: z.string().nullable(),
    vendorName: z.string().nullable(),
    currencyName: z.string().nullable(),
    createdByName: z.string().nullable(),
    depreciations: z.array(z.any()).optional(),
    changes: z.array(z.any()).optional(),
})

export const listFixedAssetsResponseSchema = z.object({
    results: z.array(fixedAssetResponseSchema),
})

export const fixedAssetAllocationResponseSchema = z.object({
    id: z.string(),
    assetId: z.string(),
    employeeId: z.string(),
    allocationDate: z.string(),
    allocationType: z.string().nullable(),
    returnDate: z.string().nullable(),
    returnType: z.string().nullable(),
    memo: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
    assetCode: z.string().nullable(),
    assetName: z.string().nullable(),
    employeeName: z.string().nullable(),
    employeeProjectId: z.string().nullable(),
    employeeDepartmentName: z.string().nullable(),
    createdByName: z.string().nullable(),
})

export const listFixedAssetAllocationsResponseSchema = z.object({
    results: z.array(fixedAssetAllocationResponseSchema),
})
