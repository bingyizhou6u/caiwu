import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types.js'
import { getUserPosition } from '../../../utils/permissions.js'
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
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const projectId = c.req.query('project_id')
    const service = c.get('services').masterData
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
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.get('services').masterData
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
