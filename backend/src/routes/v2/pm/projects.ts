/**
 * 项目管理 API 路由
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { apiSuccess } from '../../../utils/response.js'
import { Errors } from '../../../utils/errors.js'
import { hasPermission } from '../../../utils/permissions.js'
import { PermissionModule, PermissionAction } from '../../../constants/permissions.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const projectResponseSchema = z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    projectId: z.string(),
    departmentName: z.string().nullable(),
    managerId: z.string().nullable(),
    managerName: z.string().nullable(),
    status: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    actualStartDate: z.string().nullable(),
    actualEndDate: z.string().nullable(),
    priority: z.string(),
    budgetCents: z.number().nullable(),
    memo: z.string().nullable(),
    createdBy: z.string().nullable(),
    createdAt: z.number().nullable(),
    updatedAt: z.number().nullable(),
})

const createProjectSchema = z.object({
    code: z.string().optional(),
    name: z.string().min(1, '项目名称不能为空'),
    description: z.string().optional(),
    projectId: z.string().min(1, '部门不能为空'),
    managerId: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    priority: z.string().optional(),
    budgetCents: z.number().optional(),
    memo: z.string().optional(),
})

const updateProjectSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    projectId: z.string().optional(),
    managerId: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    actualStartDate: z.string().optional(),
    actualEndDate: z.string().optional(),
    priority: z.string().optional(),
    budgetCents: z.number().optional(),
    memo: z.string().optional(),
})

// 获取下一个项目编号
const nextCodeRoute = createRoute({
    method: 'get',
    path: '/next-code',
    summary: '获取下一个项目编号',
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
            description: '下一个项目编号',
        },
    },
})

app.openapi(nextCodeRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'project', 'create')) {
        throw Errors.FORBIDDEN()
    }
    const code = await c.var.services.project.getNextCode()
    return { code }
}) as any)

// 获取项目列表
const listRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取项目列表',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: z.array(projectResponseSchema),
                    }),
                },
            },
            description: '项目列表',
        },
    },
})

app.openapi(listRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'project', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const projects = await c.var.services.project.list()
    return projects
}) as any)

// 获取单个项目
const getRoute = createRoute({
    method: 'get',
    path: '/{id}',
    summary: '获取项目详情',
    request: {
        params: z.object({ id: z.string() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        data: projectResponseSchema,
                    }),
                },
            },
            description: '项目详情',
        },
    },
})

app.openapi(getRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'project', 'view')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const project = await c.var.services.project.getById(id)
    if (!project) {
        throw Errors.NOT_FOUND('项目')
    }
    return project
}) as any)

// 创建项目
const createRoute_ = createRoute({
    method: 'post',
    path: '/',
    summary: '创建项目',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createProjectSchema,
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
                        data: projectResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '创建成功',
        },
    },
})

app.openapi(createRoute_, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'project', 'create')) {
        throw Errors.FORBIDDEN()
    }
    const data = c.req.valid('json')
    const userId = c.get('employeeId')

    // 如果没有提供 code，自动生成
    if (!data.code) {
        data.code = await c.var.services.project.getNextCode()
    }

    const project = await c.var.services.project.create(data, userId)
    return project
}) as any)

// 更新项目
const updateRoute = createRoute({
    method: 'patch',
    path: '/{id}',
    summary: '更新项目',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: {
                'application/json': {
                    schema: updateProjectSchema,
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
                        data: projectResponseSchema,
                        message: z.string(),
                    }),
                },
            },
            description: '更新成功',
        },
    },
})

app.openapi(updateRoute, createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'pm', 'project', 'update')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const project = await c.var.services.project.update(id, data)
    if (!project) {
        throw Errors.NOT_FOUND('项目')
    }
    return project
}) as any)

// 删除项目
const deleteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: '删除项目',
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
    if (!hasPermission(c, 'pm', 'project', 'delete')) {
        throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')

    await c.var.services.project.delete(id)
    return null
}) as any)

export default app
