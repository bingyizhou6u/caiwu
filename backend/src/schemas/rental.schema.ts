/**
 * 租赁相关 Schema 定义
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema } from './common.schema.js'

/**
 * 创建租赁房屋Schema
 */
export const createRentalPropertySchema = z
    .object({
        propertyCode: z.string().min(1, 'propertyCode参数必填'),
        name: z.string().min(1, 'name参数必填'),
        propertyType: z.enum(['office', 'warehouse', 'dormitory', 'other']),
        currency: z.string().length(3, 'currency必须是3位币种代码'),
        rentType: z.enum(['monthly', 'yearly']),
        monthlyRentCents: z.number().int().nonnegative().optional(),
        yearlyRentCents: z.number().int().nonnegative().optional(),
        departmentId: uuidSchema.optional(),
        siteId: uuidSchema.optional(),
        paymentAccountId: uuidSchema.optional(),
        address: z.string().optional(),
        areaSqm: z.number().positive().optional(),
        paymentPeriodMonths: z.number().int().positive().optional(),
        landlordName: z.string().optional(),
        landlordContact: z.string().optional(),
        leaseStartDate: dateSchema.optional(),
        leaseEndDate: dateSchema.optional(),
        depositCents: z.number().int().nonnegative().optional(),
        paymentMethod: z.string().optional(),
        paymentDay: z.number().int().min(1).max(31).optional(),
        status: z.string().optional(),
        contractFileUrl: z.string().url().optional(),
        memo: z.string().optional(),
    })
    .refine(
        data => {
            if (data.rentType === 'yearly') {
                return data.yearlyRentCents !== undefined && data.yearlyRentCents > 0
            } else {
                return data.monthlyRentCents !== undefined && data.monthlyRentCents > 0
            }
        },
        {
            message: '年租模式需要yearlyRentCents参数，月租模式需要monthlyRentCents参数',
            path: ['rentType'],
        }
    )
    .refine(
        data => {
            if (data.leaseStartDate && data.leaseEndDate) {
                return data.leaseStartDate <= data.leaseEndDate
            }
            return true
        },
        {
            message: '租赁开始日期不能晚于结束日期',
            path: ['leaseEndDate'],
        }
    )

/**
 * 更新租赁房屋Schema
 */
export const updateRentalPropertySchema = z.object({
    name: z.string().optional(),
    propertyType: z.string().optional(),
    address: z.string().optional(),
    areaSqm: z.number().optional(),
    rentType: z.string().optional(),
    monthlyRentCents: z.number().optional(),
    yearlyRentCents: z.number().optional(),
    currency: z.string().length(3).optional(),
    paymentPeriodMonths: z.number().int().optional(),
    landlordName: z.string().optional(),
    landlordContact: z.string().optional(),
    leaseStartDate: dateSchema.optional(),
    leaseEndDate: dateSchema.optional(),
    depositCents: z.number().optional(),
    paymentMethod: z.string().optional(),
    paymentAccountId: uuidSchema.optional(),
    paymentDay: z.number().int().optional(),
    departmentId: uuidSchema.optional(),
    status: z.string().optional(),
    memo: z.string().optional(),
    contractFileUrl: z.string().url().optional(),
})

/**
 * 创建租赁付款Schema
 */
export const createRentalPaymentSchema = z.object({
    propertyId: uuidSchema,
    paymentDate: dateSchema,
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    amountCents: z.number().int().positive('amountCents必须大于0'),
    currency: z.string().length(3, 'currency必须是3位币种代码'),
    accountId: uuidSchema,
    categoryId: uuidSchema.optional(),
    paymentMethod: z.string().optional(),
    voucherUrl: z.string().url().optional(),
    memo: z.string().optional(),
})

/**
 * 更新租赁付款Schema
 */
export const updateRentalPaymentSchema = z.object({
    paymentDate: dateSchema.optional(),
    amountCents: z.number().int().positive().optional(),
    voucherUrl: z.string().url().optional(),
    memo: z.string().optional(),
})

/**
 * 分配宿舍Schema
 */
export const allocateDormitorySchema = z.object({
    employeeId: uuidSchema,
    allocationDate: dateSchema,
    roomNumber: z.string().optional().nullable(),
    bedNumber: z.string().optional().nullable(),
    monthlyRentCents: z.number().int().nonnegative().optional().nullable(),
    memo: z.string().optional().nullable(),
})

/**
 * 归还宿舍Schema
 */
export const returnDormitorySchema = z.object({
    returnDate: dateSchema,
    memo: z.string().optional(),
})
