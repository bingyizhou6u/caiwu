/**
 * 任务管理 API 路由
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { Errors } from '../../../utils/errors.js'
import { hasPermission, validateProjectAccess, getAccessibleProjectIds } from '../../../utils/permissions.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const taskResponseSchema = z.object({
    id: z.string(),
    code: z.string(),
    projectId: z.string(),
    projectName: z.string().nullable(),
    requirementId: z.string().nullable(),
    requirementTitle: z.string().nullable(),
    parentTaskId: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.string(),
    priority: z.string(),
    status: z.string(),
    estimatedHours: z.number().nullable(),
    actualHours: z.number().nullable(),
    startDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    completedAt: z.number().nullable(),
    assigneeId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    sortOrder: z.number(),
    createdBy: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
})

const createTaskSchema = z.object({
    code: z.string().optional(),
    projectId: z.string().min(1, '项目不能为空'),
    requirementId: z.string().optional(),
    parentTaskId: z.string().optional(),
    title: z.string().min(1, '任务标题不能为空'),
    description: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    estimatedHours: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    assigneeId: z.string().optional(),
})

const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    status: z.string().optional(),
    estimatedHours: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    assigneeId: z.string().optional(),
    sortOrder: z.number().optional(),
})

const updateStatusSchema = z.object({
    status: z.string().min(1, '状态不能为空'),
    sortOrder: z.number().default(0),
})

// 获取下一个任务编号
const nextCodeRoute = createRoute({
    method: 'get',
    path: '/next-code',
    summary: '获取下一个任务编号',
    request: {
        query: z.object({ projectId: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.object({ code: z.string() }),
                    }),
                },
            },
            description: '下一个任务编号',
        },
    },
})

app.openapi(nextCodeRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'create')) {
        throw Errors.FORBIDDEN()
    }
    const { projectId } = c.req.valid('query')
    // Data Scope 验证
    if (!await validateProjectAccess(c, projectId)) {
        throw Errors.FORBIDDEN('无权访问该项目')
    }
    const code = await c.var.services.task.getNextCode(projectId)
    return { code }
}) as any)

// 获取看板视图数据
const kanbanRoute = createRoute({
    method: 'get',
    path: '/kanban',
    summary: '获取看板视图数据',
    request: {
        query: z.object({ projectId: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.record(z.array(taskResponseSchema)),
                    }),
                },
            },
            description: '看板数据',
        },
    },
})

app.openapi(kanbanRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const { projectId } = c.req.valid('query')
    // Data Scope 验证
    if (!await validateProjectAccess(c, projectId)) {
        throw Errors.FORBIDDEN('无权访问该项目')
    }
    const kanban = await c.var.services.task.getKanbanData(projectId)
    return kanban
}) as any)

// 获取我的任务
app.get('/my', async c => {
    const taskService = c.var.services.task
    const userId = c.get('employeeId') as string
    const tasks = await taskService.getMyTasks(userId)
    return c.json({ success: true, data: tasks })
})

// 获取任务列表
const listRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取任务列表',
    request: {
        query: z.object({
            projectId: z.string().optional(),
            requirementId: z.string().optional(),
            status: z.string().optional(),
            assigneeId: z.string().optional(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.array(taskResponseSchema),
                    }),
                },
            },
            description: '任务列表',
        },
    },
})

app.openapi(listRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'view')) {
        throw Errors.FORBIDDEN()
    }
    let { projectId, requirementId, status, assigneeId } = c.req.valid('query')

    // Data Scope 过滤：如果指定了 projectId，验证权限；否则限制为用户可访问的项目
    if (projectId) {
        if (!await validateProjectAccess(c, projectId)) {
            throw Errors.FORBIDDEN('无权访问该项目')
        }
    } else {
        const accessibleIds = await getAccessibleProjectIds(c)
        if (accessibleIds !== undefined && accessibleIds.length > 0) {
            projectId = accessibleIds[0] // 限制为用户所属项目
        } else if (accessibleIds !== undefined && accessibleIds.length === 0) {
            return [] // 没有可访问的项目
        }
    }

    const tasks = await c.var.services.task.list({ projectId, requirementId, status, assigneeId })
    return tasks
}) as any)

// 获取单个任务
const getRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: '获取任务详情',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: taskResponseSchema,
                    }),
                },
            },
            description: '任务详情',
        },
    },
})

app.openapi(getRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const task = await c.var.services.task.getById(id)
    if (!task) {
        throw Errors.NOT_FOUND('任务')
    }
    return task
}) as any)

// 创建任务
const createRoute_ = createRoute({
    method: 'post',
    path: '/',
    summary: '创建任务',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createTaskSchema,
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
                        data: taskResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '创建成功',
        },
    },
})

app.openapi(createRoute_, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'create')) {
        throw Errors.FORBIDDEN()
    }
    const data = c.req.valid('json')
    const userId = c.get('employeeId')

    if (!data.code) {
        data.code = await c.var.services.task.getNextCode(data.projectId)
    }

    const task = await c.var.services.task.create(data, userId)
    return task
}) as any)

// 更新任务
const updateRoute = createRoute({
    method: 'patch',
    path: '/{id}',
    summary: '更新任务',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: updateTaskSchema,
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
                        data: taskResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '更新成功',
        },
    },
})

app.openapi(updateRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'task', 'update')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const task = await c.var.services.task.update(id, data)
    if (!task) {
        throw Errors.NOT_FOUND('任务')
    }
    return task
}) as any)

// 更新任务状态（用于看板拖拽）
const updateStatusRoute = createRoute({
    method: 'patch',
    path: '/{id}/status',
    summary: '更新任务状态',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: updateStatusSchema,
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
                        data: taskResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '更新成功',
        },
    },
})

app.openapi(updateStatusRoute, createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')
    const userId = c.get('employeeId')

    // 检查权限：有 pm.task.update 权限，或者是任务的负责人
    const task = await c.var.services.task.getById(id)
    if (!task) {
        throw Errors.NOT_FOUND('任务')
    }

    const canUpdate = hasPermission(c, 'pm', 'task', 'update') || task.assigneeId === userId
    if (!canUpdate) {
        throw Errors.FORBIDDEN('无权限更新此任务')
    }

    const { status, sortOrder } = c.req.valid('json')
    const updatedTask = await c.var.services.task.updateStatus(id, status, sortOrder)
    return updatedTask
}) as any)

// 删除任务
const deleteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: '删除任务',
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
    if (!hasPermission(c, 'pm', 'task', 'delete')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')

    await c.var.services.task.delete(id)
    return null
}) as any)

export default app
