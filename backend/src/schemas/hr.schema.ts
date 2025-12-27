/**
 * HR 相关 Schema 定义 (员工、薪资、补贴、请假、报销)
 */

import { z } from '@hono/zod-openapi'
import { uuidSchema, dateSchema, emailSchema } from './common.schema.js'

/**
 * 创建员工Schema
 */
export const createEmployeeSchema = z.object({
    name: z.string().min(1, 'name参数必填'),
    orgProjectId: uuidSchema,
    positionId: uuidSchema,
    projectId: uuidSchema.optional(),
    joinDate: dateSchema,
    email: emailSchema,
    birthday: dateSchema,
    phone: z.string().optional(),
    probationSalaries: z
        .array(
            z.object({
                currencyId: z.string(),
                amountCents: z.number().int().nonnegative(),
            })
        )
        .optional(),
    regularSalaries: z
        .array(
            z.object({
                currencyId: z.string(),
                amountCents: z.number().int().nonnegative(),
            })
        )
        .optional(),
    usdtAddress: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    address: z.string().optional(),
    memo: z.string().optional(),
    workSchedule: z
        .object({
            days: z.array(z.number().int().min(1).max(7)),
            start: z.string().regex(/^\d{2}:\d{2}$/),
            end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional(),
    annualLeaveCycleMonths: z.number().int().min(6).max(12).optional(),
    annualLeaveDays: z.number().int().min(0).max(365).optional(),
})

/**
 * 更新员工Schema
 */
export const updateEmployeeSchema = z.object({
    name: z.string().min(1).optional(),
    projectId: z.string().optional(),
    orgProjectId: z.string().optional().nullable(),
    positionId: z.string().optional().nullable(),
    joinDate: dateSchema.optional(),
    active: z.number().int().min(0).max(1).optional(),
    phone: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        if (typeof val === 'string' && val.length <= 5) { return null }
        return val
    }, z.string().nullable().optional()),
    email: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        return val
    }, z.string().email('邮箱格式不正确').nullable().optional()),
    usdtAddress: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        return val
    }, z.string().nullable().optional()),
    emergencyContact: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        return val
    }, z.string().nullable().optional()),
    emergencyPhone: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        if (typeof val === 'string' && val.length <= 5) { return null }
        return val
    }, z.string().nullable().optional()),
    address: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        return val
    }, z.string().nullable().optional()),
    memo: z.preprocess(val => {
        if (val === '' || val === undefined || val === null) { return null }
        return val
    }, z.string().nullable().optional()),
    birthday: z.preprocess(
        val => {
            if (val === '' || val === undefined || val === null) { return null }
            return val
        },
        z.union([dateSchema, z.null()]).optional()
    ),
    workSchedule: z
        .object({
            days: z.array(z.number().int().min(1).max(7)),
            start: z.string().regex(/^\d{2}:\d{2}$/),
            end: z.string().regex(/^\d{2}:\d{2}$/),
        })
        .optional()
        .nullable(),
    annualLeaveCycleMonths: z.number().int().min(6).max(12).optional(),
    annualLeaveDays: z.number().int().min(0).max(365).optional(),
})

/**
 * 员工转正Schema
 */
export const regularizeEmployeeSchema = z.object({
    regularDate: dateSchema,
})

/**
 * 员工离职Schema
 */
export const leaveEmployeeSchema = z.object({
    leaveDate: dateSchema,
    leaveType: z.enum(['resigned', 'terminated', 'expired', 'retired', 'other']),
    leaveReason: z.string().optional(),
    leaveMemo: z.string().optional(),
    disableAccount: z.boolean().optional(),
})

// ============= 薪资相关 =============

/**
 * 创建员工薪资Schema
 */
export const createEmployeeSalarySchema = z.object({
    employeeId: uuidSchema,
    salaryType: z.enum(['probation', 'regular']),
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
})

/**
 * 生成薪资单Schema
 */
export const generateSalaryPaymentsSchema = z.object({
    year: z.number().int().min(2000).max(2100, '年份必须在2000-2100之间'),
    month: z.number().int().min(1).max(12, '月份必须在1-12之间'),
})

/**
 * 薪资单操作Schema（无参数操作）
 */
export const salaryPaymentActionSchema = z.object({}).optional()

/**
 * 薪资转账Schema
 */
export const salaryPaymentTransferSchema = z.object({
    accountId: uuidSchema,
})

/**
 * 创建薪资分配Schema
 */
export const createSalaryAllocationSchema = z.object({
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    accountId: uuidSchema,
    amountCents: z.number().int().positive('amountCents必须大于0'),
    memo: z.string().optional(),
})

/**
 * 批量创建薪资分配Schema
 */
export const batchCreateSalaryAllocationsSchema = z.object({
    allocations: z.array(createSalaryAllocationSchema).min(1, 'allocations数组不能为空'),
})

/**
 * 员工申请薪资分配Schema
 */
export const requestSalaryAllocationsSchema = z.object({
    allocations: z
        .array(
            z.object({
                currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
                accountId: uuidSchema.optional(),
                amountCents: z.number().int().positive('amountCents必须大于0'),
            })
        )
        .min(1, 'allocations数组不能为空'),
})

// ============= 补贴相关 =============

/**
 * 创建员工补贴Schema
 */
export const createEmployeeAllowanceSchema = z.object({
    employeeId: uuidSchema,
    allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
})

/**
 * 批量更新员工补贴Schema
 */
export const batchUpdateEmployeeAllowancesSchema = z.object({
    employeeId: uuidSchema,
    allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
    allowances: z
        .array(
            z.object({
                currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
                amountCents: z.number().int().nonnegative('amountCents必须大于等于0'),
            })
        )
        .min(0, 'allowances必须是数组'),
})

/**
 * 生成补贴发放Schema
 */
export const generateAllowancePaymentsSchema = z.object({
    year: z.number().int().min(2000).max(2100, '年份必须在2000-2100之间'),
    month: z.number().int().min(1).max(12, '月份必须在1-12之间'),
    paymentDate: dateSchema,
})

/**
 * 创建津贴支付Schema
 */
export const createAllowancePaymentSchema = z.object({
    employeeId: uuidSchema,
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    allowanceType: z.enum(['living', 'housing', 'transportation', 'meal', 'birthday']),
    currencyId: z.string().length(3, 'currencyId必须是3位币种代码'),
    amountCents: z.number().int().positive('amountCents必须大于0'),
    paymentDate: dateSchema,
    paymentMethod: z.enum(['cash', 'transfer']).optional(),
    voucherUrl: z.string().url().optional(),
    memo: z.string().optional(),
})

/**
 * 更新津贴支付Schema
 */
export const updateAllowancePaymentSchema = z.object({
    amountCents: z.number().int().positive().optional(),
    paymentDate: dateSchema.optional(),
    paymentMethod: z.enum(['cash', 'transfer']).optional(),
    voucherUrl: z.string().url().optional(),
    memo: z.string().optional(),
})

// ============= 请假相关 =============

/**
 * 创建请假Schema
 */
export const createEmployeeLeaveSchema = z
    .object({
        employeeId: uuidSchema,
        leaveType: z.string().min(1, 'leaveType参数必填'),
        startDate: dateSchema,
        endDate: dateSchema,
        days: z.number().int().positive('days必须为正数'),
        reason: z.string().optional(),
        memo: z.string().optional(),
    })
    .refine(data => data.startDate <= data.endDate, {
        message: '开始日期不能晚于结束日期',
        path: ['endDate'],
    })
    .refine(
        data => {
            const start = new Date(data.startDate + 'T00:00:00Z')
            const end = new Date(data.endDate + 'T00:00:00Z')
            return start <= end
        },
        { message: '开始日期必须早于或等于结束日期', path: ['endDate'] }
    )

/**
 * 审批请假Schema
 */
export const approveEmployeeLeaveSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    memo: z.string().optional(),
})

// ============= 报销相关 =============

/**
 * 创建报销Schema
 */
export const createExpenseSchema = z.object({
    employeeId: uuidSchema,
    expenseType: z.string().min(1, 'expenseType参数必填'),
    amountCents: z.number().int().positive('amountCents必须为正数'),
    expenseDate: dateSchema,
    description: z.string().min(1, 'description参数必填'),
    currencyId: z.string().min(1, 'currencyId参数必填'),
    voucherUrl: z.string().url().min(1, 'voucherUrl参数必填'),
    memo: z.string().optional(),
})

// ============= Response Schemas =============

export const employeeAllowanceResponseSchema = z.object({
    id: z.string(),
    employeeId: z.string(),
    allowanceType: z.string(),
    currencyId: z.string(),
    amountCents: z.number(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
    currencyName: z.string().nullable(),
    employeeName: z.string().nullable(),
})

export const listEmployeeAllowancesResponseSchema = z.object({
    results: z.array(employeeAllowanceResponseSchema),
})

export const allowancePaymentResponseSchema = z.object({
    id: z.string(),
    employeeId: z.string(),
    year: z.number(),
    month: z.number(),
    allowanceType: z.string(),
    currencyId: z.string(),
    amountCents: z.number(),
    paymentDate: z.string(),
    paymentMethod: z.string().nullable(),
    voucherUrl: z.string().nullable(),
    memo: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
    employeeName: z.string().nullable(),
    departmentName: z.string().nullable(),
    currencyName: z.string().nullable(),
    createdByName: z.string().nullable(),
})

export const listAllowancePaymentsResponseSchema = z.object({
    results: z.array(allowancePaymentResponseSchema),
})
