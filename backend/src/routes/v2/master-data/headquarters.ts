import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { createPermissionContext } from '../../../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../../../constants/permissions.js'
import { logAuditAction } from '../../../utils/audit.js'
import { Errors } from '../../../utils/errors.js'
import {
  createHeadquartersSchema,
  updateHeadquartersSchema,
  headquartersSchema,
} from '../../../schemas/master-data.schema.js'
import { apiSuccess, jsonResponse } from '../../../utils/response.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

export const headquartersRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：检查总部权限
 */
function requireHeadquartersPermission(c: any, action: string): ReturnType<typeof createPermissionContext> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission(PermissionModule.SYSTEM, 'headquarters', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

const listHeadquartersRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取总部列表',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(headquartersSchema),
          }),
        },
      },
      description: '总部列表',
    },
  },
})

headquartersRoutes.openapi(
  listHeadquartersRoute,
  createRouteHandler(async (c: any) => {
    const masterDataService = c.var.services.masterData
    const results = await masterDataService.getHeadquarters()
    return results
  }) as any
)

const createHeadquartersRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建总部',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createHeadquartersSchema,
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
            data: z.object({}).optional(),
          }),
        },
      },
      description: '创建成功',
    },
  },
})

headquartersRoutes.openapi(createHeadquartersRoute, async c => {
  throw Errors.BUSINESS_ERROR('总部配置已禁用')
})

const updateHeadquartersRoute = createRoute({
  method: 'put',
  path: '/{id}',
  summary: '更新总部',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateHeadquartersSchema,
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
            data: z.object({}).optional(),
          }),
        },
      },
      description: '更新成功',
    },
  },
})

headquartersRoutes.openapi(
  updateHeadquartersRoute,
  createRouteHandler(async (c: any) => {
    requireHeadquartersPermission(c, PermissionAction.UPDATE)
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    await service.updateHeadquarters(id, {
      name: body.name,
      active: body.active ?? undefined,
    })

    logAuditAction(c, 'update', 'headquarters', id, JSON.stringify(body))
    return {}
  }) as any
)

const deleteHeadquartersRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: '删除总部',
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
            data: z.object({}).optional(),
          }),
        },
      },
      description: '删除成功',
    },
  },
})

headquartersRoutes.openapi(
  deleteHeadquartersRoute,
  createRouteHandler(async (c: any) => {
    requireHeadquartersPermission(c, PermissionAction.DELETE)
    const id = c.req.param('id')
    const service = c.var.services.masterData

    const result = await service.deleteHeadquarters(id)

    logAuditAction(c, 'delete', 'headquarters', id, JSON.stringify({ name: result.name }))
    return {}
  }) as any
)
