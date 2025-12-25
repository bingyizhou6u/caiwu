import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { getUserPosition } from '../../../utils/permissions.js'
import { Errors } from '../../../utils/errors.js'
import {
  positionSchema,
  availablePositionsResponseSchema,
} from '../../../schemas/master-data.schema.js'
import { apiSuccess, jsonResponse } from '../../../utils/response.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

export const positionsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const listPositionsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取职位列表',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(positionSchema),
            }),
          }),
        },
      },
      description: '职位列表',
    },
  },
})

positionsRoutes.openapi(
  listPositionsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const service = c.var.services.masterData
    const results = await service.getPositions()
    return { results }
  }) as any
)

const getAvailablePositionsRoute = createRoute({
  method: 'get',
  path: '/available',
  summary: '获取可用职位列表',
  request: {
    query: z.object({
      orgDepartmentId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(), // The result is a complex object, simplify for now
          }),
        },
      },
      description: '可用职位列表',
    },
  },
})

positionsRoutes.openapi(
  getAvailablePositionsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const orgDepartmentId = c.req.query('orgDepartmentId')
    if (!orgDepartmentId) {
      throw Errors.VALIDATION_ERROR('orgDepartmentId参数必填')}

    const service = c.var.services.masterData
    const result = await service.getAvailablePositions(orgDepartmentId)

    // Result is directly the data we want
    return result
  }) as any
)
