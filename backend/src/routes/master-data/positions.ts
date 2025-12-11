import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { positionSchema, availablePositionsResponseSchema } from '../../schemas/master-data.schema.js'

export const positionsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listPositionsRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取职位列表',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(positionSchema)
                    })
                }
            },
            description: '职位列表'
        }
    }
})

positionsRoutes.openapi(listPositionsRoute, async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const service = c.get('services').masterData
    const results = await service.getPositions()
    return c.json({ results })
})

const getAvailablePositionsRoute = createRoute({
    method: 'get',
    path: '/available',
    summary: '获取可用职位列表',
    request: {
        query: z.object({
            orgDepartmentId: z.string()
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.any()
                }
            },
            description: '可用职位列表'
        }
    }
})

positionsRoutes.openapi(getAvailablePositionsRoute, async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const orgDepartmentId = c.req.query('orgDepartmentId')
    if (!orgDepartmentId) throw Errors.VALIDATION_ERROR('orgDepartmentId参数必填')

    const service = c.get('services').masterData
    const result = await service.getAvailablePositions(orgDepartmentId)

    return c.json(result)
})
