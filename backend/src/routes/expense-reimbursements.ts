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
        const db = c.get('db')

        let query = db.select({
            id: expenseReimbursements.id,
            employeeId: expenseReimbursements.employeeId,
            employeeName: employees.name,
            expenseType: expenseReimbursements.expenseType,
            amountCents: expenseReimbursements.amountCents,
            currencyId: expenseReimbursements.currencyId,
            expenseDate: expenseReimbursements.expenseDate,
            description: expenseReimbursements.description,
            voucherUrl: expenseReimbursements.voucherUrl,
            status: expenseReimbursements.status,
            approvedBy: expenseReimbursements.approvedBy,
            approvedAt: expenseReimbursements.approvedAt,
            memo: expenseReimbursements.memo,
            createdBy: expenseReimbursements.createdBy,
            createdAt: expenseReimbursements.createdAt,
            updatedAt: expenseReimbursements.updatedAt,
        })
            .from(expenseReimbursements)
            .leftJoin(employees, eq(expenseReimbursements.employeeId, employees.id))
            .$dynamic()

        const filters = []
        if (employeeId) filters.push(eq(expenseReimbursements.employeeId, employeeId))
        if (status) filters.push(eq(expenseReimbursements.status, status))

        if (filters.length > 0) {
            query = query.where(and(...filters))
        }

        const results = await query.orderBy(desc(expenseReimbursements.createdAt))

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
        const db = c.get('db')
        const userId = c.get('userId')

        const newReimbursement = {
            id: nanoid(),
            ...body,
            status: 'pending',
            createdBy: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }

        await db.insert(expenseReimbursements).values(newReimbursement)

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
        const db = c.get('db')
        const userId = c.get('userId')

        const updateData: any = {
            status,
            updatedAt: Date.now(),
        }

        if (status === 'approved' || status === 'rejected') {
            updateData.approvedBy = userId
            updateData.approvedAt = Date.now()
        }

        if (memo) {
            updateData.memo = memo
        }

        await db.update(expenseReimbursements)
            .set(updateData)
            .where(eq(expenseReimbursements.id, id))

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
        const db = c.get('db')
        // const userId = c.get('userId') // Not used yet but might be for audit

        const reimbursement = await db.select().from(expenseReimbursements).where(eq(expenseReimbursements.id, id)).get()
        if (!reimbursement) throw Errors.NOT_FOUND('报销单')

        // 检查是否已支付或未批准？通常必须先批准。
        if (reimbursement.status !== 'approved') throw Errors.BUSINESS_ERROR('报销单未审批通过或已支付')

        await db.update(expenseReimbursements)
            .set({
                status: 'paid',
                updatedAt: Date.now(),
            })
            .where(eq(expenseReimbursements.id, id))

        return c.json({ success: true })
    }
)
