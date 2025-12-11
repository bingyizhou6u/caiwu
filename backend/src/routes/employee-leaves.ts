import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, desc, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { employeeLeaves, employees } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { getUserPosition, hasPermission } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'

export const employeesLeavesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const LeaveSchema = z.object({
    id: z.string(),
    employeeId: z.string(),
    employeeName: z.string().nullable().optional(),
    leaveType: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    days: z.number(),
    status: z.string().nullable(),
    reason: z.string().optional().nullable(),
    memo: z.string().optional().nullable(),
    approvedBy: z.string().optional().nullable(),
    approvedAt: z.number().optional().nullable(),
    createdAt: z.number().optional().nullable(),
    updatedAt: z.number().optional().nullable(),
})

const CreateLeaveSchema = z.object({
    employeeId: z.string(),
    leaveType: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    days: z.number(),
    reason: z.string().optional(),
    memo: z.string().optional(),
})

const UpdateLeaveStatusSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
    memo: z.string().optional(),
})

// 获取请假列表
employeesLeavesRoutes.openapi(
    createRoute({
        method: 'get',
        path: '/',
        tags: ['Employee Leaves'],
        summary: 'List employee leaves',
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
                        schema: z.array(LeaveSchema),
                    },
                },
                description: 'List of employee leaves',
            },
        },
    }),
    async (c) => {
        if (!getUserPosition(c)) throw Errors.FORBIDDEN()
        const { employeeId, status } = c.req.valid('query')
        const db = c.get('db')

        let query = db.select({
            id: employeeLeaves.id,
            employeeId: employeeLeaves.employeeId,
            employeeName: employees.name,
            leaveType: employeeLeaves.leaveType,
            startDate: employeeLeaves.startDate,
            endDate: employeeLeaves.endDate,
            days: employeeLeaves.days,
            status: employeeLeaves.status,
            reason: employeeLeaves.reason,
            memo: employeeLeaves.memo,
            approvedBy: employeeLeaves.approvedBy,
            approvedAt: employeeLeaves.approvedAt,
            createdAt: employeeLeaves.createdAt,
            updatedAt: employeeLeaves.updatedAt,
        })
            .from(employeeLeaves)
            .leftJoin(employees, eq(employeeLeaves.employeeId, employees.id))
            .$dynamic()

        const filters = []
        if (employeeId) filters.push(eq(employeeLeaves.employeeId, employeeId))
        if (status) filters.push(eq(employeeLeaves.status, status))

        if (filters.length > 0) {
            query = query.where(and(...filters))
        }

        const results = await query.orderBy(desc(employeeLeaves.createdAt))

        return c.json(results)
    }
)

// 创建请假申请
employeesLeavesRoutes.openapi(
    createRoute({
        method: 'post',
        path: '/',
        tags: ['Employee Leaves'],
        summary: 'Create employee leave',
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: CreateLeaveSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': {
                        schema: LeaveSchema,
                    },
                },
                description: 'Created employee leave',
            },
        },
    }),
    async (c) => {
        if (!hasPermission(c, 'hr', 'leave', 'create')) throw Errors.FORBIDDEN()
        const body = c.req.valid('json')
        const db = c.get('db')

        const newLeave = {
            id: nanoid(),
            ...body,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }

        await db.insert(employeeLeaves).values(newLeave)

        return c.json(newLeave)
    }
)

// 更新请假状态
employeesLeavesRoutes.openapi(
    createRoute({
        method: 'put',
        path: '/{id}/status',
        tags: ['Employee Leaves'],
        summary: 'Update employee leave status',
        request: {
            params: z.object({
                id: z.string(),
            }),
            body: {
                content: {
                    'application/json': {
                        schema: UpdateLeaveStatusSchema,
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
                description: 'Updated employee leave status',
            },
        },
    }),
    async (c) => {
        if (!hasPermission(c, 'hr', 'leave', 'approve')) throw Errors.FORBIDDEN()
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

        await db.update(employeeLeaves)
            .set(updateData)
            .where(eq(employeeLeaves.id, id))

        return c.json({ success: true })
    }
)
