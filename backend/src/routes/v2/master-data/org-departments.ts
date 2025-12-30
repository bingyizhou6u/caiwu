import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { createPermissionContext } from '../../../utils/permission-context.js'
import { DataScope } from '../../../constants/permissions.js'
import { Errors } from '../../../utils/errors.js'
import { orgDepartmentSchema } from '../../../schemas/master-data.schema.js'
import { apiSuccess, jsonResponse } from '../../../utils/response.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

export const orgDepartmentsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const listOrgDepartmentsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取组织部门列表',
  request: {
    query: z.object({
      project_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                orgDepartmentSchema.extend({
                  default_position_name: z.string().optional().nullable(),
                  parent_name: z.string().optional().nullable(),
                  project_name: z.string().optional().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: '组织部门列表',
    },
  },
})

orgDepartmentsRoutes.openapi(
  listOrgDepartmentsRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx) {
      throw Errors.FORBIDDEN()
    }
    const projectId = c.req.query('project_id')
    const service = c.var.services.masterData
    const results = await service.getOrgDepartments(projectId)

    const mappedResults = results.map((r: any) => ({
      id: r.id,
      project_id: r.projectId,
      parentId: r.parentId,
      name: r.name,
      code: r.code,
      description: r.description,
      allowed_modules: r.allowedModules as any,
      allowed_positions: r.allowedPositions as any,
      default_position_id: r.defaultPositionId,
      active: r.active,
      sortOrder: r.sortOrder,
      default_position_name: r.defaultPositionName,
      parent_name: r.parentName,
      project_name: r.projectName,
    }))

    return { results: mappedResults }
  }) as any
)

const getOrgDepartmentRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: '获取组织部门详情',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: orgDepartmentSchema.extend({
              default_position_name: z.string().optional().nullable(),
            }),
          }),
        },
      },
      description: '组织部门详情',
    },
  },
})

orgDepartmentsRoutes.openapi(
  getOrgDepartmentRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.masterData
    const result = (await service.getOrgDepartment(id)) as any

    return {
      id: result.id,
      project_id: result.projectId,
      parentId: result.parentId,
      name: result.name,
      code: result.code,
      description: result.description,
      allowed_modules: result.allowedModules as any,
      allowed_positions: result.allowedPositions as any,
      default_position_id: result.defaultPositionId,
      active: result.active,
      sortOrder: result.sortOrder,
      default_position_name: result.defaultPositionName,
    }
  }) as any
)

// 创建组织部门
const createOrgDepartmentRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建组织部门',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.string(),
            parentId: z.string().optional().nullable(),
            name: z.string().min(1),
            code: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            allowedModules: z.array(z.string()).optional().nullable(),
            allowedPositions: z.array(z.string()).optional().nullable(),
            defaultPositionId: z.string().optional().nullable(),
            sortOrder: z.number().int().optional(),
          }),
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
            data: orgDepartmentSchema,
          }),
        },
      },
      description: '创建成功',
    },
  },
})

orgDepartmentsRoutes.openapi(
  createOrgDepartmentRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || permCtx.dataScope !== DataScope.ALL) {
      throw Errors.FORBIDDEN('无权限创建组织部门')
    }
    const body = await c.req.json()
    const service = c.var.services.orgDepartment
    const result = await service.createOrgDepartment(body)
    return result
  }) as any
)

// 更新组织部门
const updateOrgDepartmentRoute = createRoute({
  method: 'put',
  path: '/{id}',
  summary: '更新组织部门',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            parentId: z.string().optional().nullable(),
            name: z.string().min(1).optional(),
            code: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            allowedModules: z.array(z.string()).optional().nullable(),
            allowedPositions: z.array(z.string()).optional().nullable(),
            defaultPositionId: z.string().optional().nullable(),
            sortOrder: z.number().int().optional(),
            active: z.number().int().min(0).max(1).optional(),
          }),
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
            data: orgDepartmentSchema,
          }),
        },
      },
      description: '更新成功',
    },
  },
})

orgDepartmentsRoutes.openapi(
  updateOrgDepartmentRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || permCtx.dataScope !== DataScope.ALL) {
      throw Errors.FORBIDDEN('无权限更新组织部门')
    }
    const id = c.req.param('id')
    const body = await c.req.json()
    const service = c.var.services.orgDepartment
    const result = await service.updateOrgDepartment(id, body)
    return result
  }) as any
)

// 删除组织部门
const deleteOrgDepartmentRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: '删除组织部门',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: '删除成功',
    },
  },
})

orgDepartmentsRoutes.openapi(
  deleteOrgDepartmentRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || permCtx.dataScope !== DataScope.ALL) {
      throw Errors.FORBIDDEN('无权限删除组织部门')
    }
    const id = c.req.param('id')
    const service = c.var.services.orgDepartment
    await service.deleteOrgDepartment(id)
    return { success: true }
  }) as any
)

