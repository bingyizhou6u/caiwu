import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, desc, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { expenseReimbursements, employees } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { Errors } from '../utils/errors.js'
import { getUserPosition, hasPermission } from '../utils/permissions.js'

export const expenseReimbursementsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const ReimbursementSchema = z.object({
    id: z.string(),
    employeeId: z.string(),
    employeeName: z.string().nullable().optional(),
    expenseType: z.string(),
    amountCents: z.number(),
    currencyId: z.string().nullable().optional(),
    expenseDate: z.string(),
    description: z.string(),
    voucherUrl: z.string().optional().nullable(),
    status: z.string().nullable(),
    approvedBy: z.string().optional().nullable(),
    approvedAt: z.number().optional().nullable(),
    memo: z.string().optional().nullable(),
    createdBy: z.string().optional().nullable(),
    createdAt: z.number().optional().nullable(),
    updatedAt: z.number().optional().nullable(),
})

const CreateReimbursementSchema = z.object({
    employeeId: z.string(),
    expenseType: z.string(),
    amountCents: z.number(),
    currencyId: z.string().optional(),
    expenseDate: z.string(),
    description: z.string(),
    voucherUrl: z.string().optional(),
    memo: z.string().optional(),
})

const UpdateReimbursementStatusSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
    memo: z.string().optional(),
})

// 获取报销列表
expenseReimbursementsRoutes.openapi(
    createRoute({
        method: 'get',
        path: '/',
        tags: ['Expense Reimbursements'],
        summary: 'List expense reimbursements',
        request: {
            query: z.object({
                employeeId: z.string().optional(),
                status: z.string().optional(),
            }),
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.array(ReimbursementSchema),
                    },
                },
                description: 'List of expense reimbursements',
            },
        },
    }),
    async (c) => {
        if (!getUserPosition(c)) throw Errors.FORBIDDEN()
        const { employeeId, status } = c.req.valid('query')
        const results = await c.var.services.expenseReimbursement.listReimbursements({ employeeId, status })
        return c.json(results)
    }
)

// 创建报销申请
expenseReimbursementsRoutes.openapi(
    createRoute({
        method: 'post',
        path: '/',
        tags: ['Expense Reimbursements'],
        summary: 'Create expense reimbursement',
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: CreateReimbursementSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: ReimbursementSchema,
                    },
                },
                description: 'Created expense reimbursement',
            },
        },
    }),
    async (c) => {
        if (!hasPermission(c, 'finance', 'reimbursement', 'create')) throw Errors.FORBIDDEN()
        const body = c.req.valid('json')
        const userId = c.get('userId')

        const newReimbursement = await c.var.services.expenseReimbursement.createReimbursement({
            ...body,
            createdBy: userId
        })

        return c.json(newReimbursement)
    }
)

// 更新报销状态
expenseReimbursementsRoutes.openapi(
    createRoute({
        method: 'put',
        path: '/{id}/status',
        tags: ['Expense Reimbursements'],
        summary: 'Update expense reimbursement status',
        request: {
            params: z.object({
                id: z.string(),
            }),
            body: {
                content: {
                    'application/json': {
                        schema: UpdateReimbursementStatusSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({ success: z.boolean() }),
                    },
                },
                description: 'Updated expense reimbursement status',
            },
        },
    }),
    async (c) => {
        if (!hasPermission(c, 'finance', 'reimbursement', 'approve')) throw Errors.FORBIDDEN()
        const { id } = c.req.valid('param')
        const { status, memo } = c.req.valid('json')
        const userId = c.get('userId')

        await c.var.services.expenseReimbursement.updateStatus(id, status, {
            approvedBy: userId || undefined,
            memo: memo || undefined
        })

        return c.json({ success: true })
    }
)

// 支付报销
expenseReimbursementsRoutes.openapi(
    createRoute({
        method: 'post',
        path: '/{id}/pay',
        tags: ['Expense Reimbursements'],
        summary: 'Pay expense reimbursement',
        request: {
            params: z.object({
                id: z.string(),
            }),
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: z.object({ success: z.boolean() }),
                    },
                },
                description: 'Paid expense reimbursement',
            },
        },
    }),
    async (c) => {
        if (!hasPermission(c, 'finance', 'reimbursement', 'pay')) throw Errors.FORBIDDEN()
        const { id } = c.req.valid('param')

        await c.var.services.expenseReimbursement.payReimbursement(id)

        return c.json({ success: true })
    }
)
