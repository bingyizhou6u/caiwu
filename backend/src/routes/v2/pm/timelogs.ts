/**
 * 工时记录 API 路由
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { Errors } from '../../../utils/errors.js'
import { hasPermission, validateProjectAccess } from '../../../utils/permissions.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const timelogResponseSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    taskTitle: z.string().nullable(),
    employeeId: z.string(),
    employeeName: z.string().nullable(),
    logDate: z.string(),
    hours: z.number(),
    description: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
})

const createTimelogSchema = z.object({
    taskId: z.string().min(1, '任务不能为空'),
    logDate: z.string().min(1, '日期不能为空'),
    hours: z.number().min(0.5, '工时最少为 0.5 小时').max(24, '工时不能超过 24 小时'),
    description: z.string().optional(),
})

const updateTimelogSchema = z.object({
    logDate: z.string().optional(),
    hours: z.number().min(0.5).max(24).optional(),
    description: z.string().optional(),
})

// 获取我的工时
app.get('/my', async c => {
    const timelogService = c.var.services.taskTimelog
    const userId = c.get('employeeId')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    const timelogs = await timelogService.getMyTimelogs(userId as string, startDate, endDate)
    return c.json({ success: true, data: timelogs })
})

// 获取团队工时汇总
const teamSummaryRoute = createRoute({
    method: 'get',
    path: '/team-summary',
    summary: '获取团队工时汇总',
    request: {
        query: z.object({
            projectId: z.string(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.array(z.object({
                            employeeId: z.string(),
                            employeeName: z.string().nullable(),
                            totalHours: z.number(),
                        })),
                    }),
                },
            },
            description: '团队工时汇总',
        },
    },
})

app.openapi(teamSummaryRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'timelog', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const { projectId, startDate, endDate } = c.req.valid('query')
    // Data Scope 验证
    if (!validateProjectAccess(c, projectId)) {
        throw Errors.FORBIDDEN('无权访问该项目')
    }
    const summary = await c.var.services.taskTimelog.getTeamWorkloadSummary(projectId, startDate, endDate)
    return summary
}) as any)

// 获取工时列表
const listRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取工时列表',
    request: {
        query: z.object({
            taskId: z.string().optional(),
            employeeId: z.string().optional(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.array(timelogResponseSchema),
                    }),
                },
            },
            description: '工时列表',
        },
    },
})

app.openapi(listRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'timelog', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const { taskId, employeeId } = c.req.valid('query')
    const timelogs = await c.var.services.taskTimelog.list({ taskId, employeeId })
    return timelogs
}) as any)

// 获取单个工时记录
app.get('/:id', async c => {
    const timelogService = c.var.services.taskTimelog
    const id = c.req.param('id')
    const userId = c.get('employeeId')

    const timelog = await timelogService.getById(id)
    if (!timelog) {
        throw Errors.NOT_FOUND('工时记录')
    }

    // 检查权限：有 pm.timelog.view 权限，或者是自己的工时
    const canView = hasPermission(c, 'pm', 'timelog', 'view') || timelog.employeeId === userId
    if (!canView) {
        throw Errors.FORBIDDEN('无权限查看此工时记录')
    }

    return c.json({ success: true, data: timelog })
})

// 创建工时记录
const createRoute_ = createRoute({
    method: 'post',
    path: '/',
    summary: '创建工时记录',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createTimelogSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: timelogResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '创建成功',
        },
    },
})

app.openapi(createRoute_, createRouteHandler(async (c: any) => {
    const data = c.req.valid('json')
    const userId = c.get('employeeId')

    const timelog = await c.var.services.taskTimelog.create(data, userId)
    return timelog
}) as any)

// 更新工时记录
const updateRoute = createRoute({
    method: 'patch',
    path: '/{id}',
    summary: '更新工时记录',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: updateTimelogSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: timelogResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '更新成功',
        },
    },
})

app.openapi(updateRoute, createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const userId = c.get('employeeId')

    const existing = await c.var.services.taskTimelog.getById(id)
    if (!existing) {
        throw Errors.NOT_FOUND('工时记录')
    }

    const canUpdate = hasPermission(c, 'pm', 'timelog', 'update') || existing.employeeId === userId
    if (!canUpdate) {
        throw Errors.FORBIDDEN('无权限修改此工时记录')
    }

    const timelog = await c.var.services.taskTimelog.update(id, data)
    return timelog
}) as any)

// 删除工时记录
const deleteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: '删除工时记录',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                },
            },
            description: '删除成功',
        },
    },
})

app.openapi(deleteRoute, createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')
    const userId = c.get('employeeId')

    const existing = await c.var.services.taskTimelog.getById(id)
    if (!existing) {
        throw Errors.NOT_FOUND('工时记录')
    }

    const canDelete = hasPermission(c, 'pm', 'timelog', 'delete') || existing.employeeId === userId
    if (!canDelete) {
        throw Errors.FORBIDDEN('无权限删除此工时记录')
    }

    await c.var.services.taskTimelog.delete(id)
    return null
}) as any)

export default app
