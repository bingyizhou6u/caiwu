import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createPositionSchema, updatePositionSchema } from '../../schemas/business.schema.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const positionPermissionsRoutes = new OpenAPIHono<{
  Bindings: Env
  Variables: AppVariables
}>()

// Schemas
const positionResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  level: z.number(),
  functionRole: z.string(),
  permissions: z.any().optional(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  active: z.number().nullable(),
  canManageSubordinates: z.number().nullable().optional(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
})

// Get All Positions
const getAllPositionsRoute = createRoute({
  method: 'get',
  path: '/position-permissions',
  tags: ['Position Permissions'],
  summary: 'Get all positions',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(positionResponseSchema),
            }),
          }),
        },
      },
      description: 'Position list',
    },
  },
})

positionPermissionsRoutes.openapi(getAllPositionsRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'position', 'view')) {
      throw Errors.FORBIDDEN()
    }
  const results = await c.var.services.position.getPositions()
  return { results }
}))

// Get Position
const getPositionRoute = createRoute({
  method: 'get',
  path: '/position-permissions/{id}',
  tags: ['Position Permissions'],
  summary: 'Get position details',
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
            data: positionResponseSchema,
          }),
        },
      },
      description: 'Position details',
    },
  },
})

positionPermissionsRoutes.openapi(getPositionRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'position', 'view')) {
      throw Errors.FORBIDDEN()
    }
  const id = c.req.param('id')
  if (!id) {
      throw Errors.VALIDATION_ERROR('Position ID is required')}
  const positions = await c.var.services.position.getPositions()
  const position = positions.find((p: any) => p.id === id)
  if (!position) {
      throw Errors.NOT_FOUND('职位')}
  return position
}) as any)

// Create Position
const createPositionRoute = createRoute({
  method: 'post',
  path: '/position-permissions',
  tags: ['Position Permissions'],
  summary: 'Create position',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createPositionSchema,
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
            data: positionResponseSchema.partial().and(z.object({ id: z.string() })),
          }),
        },
      },
      description: 'Created position',
    },
  },
})

positionPermissionsRoutes.openapi(createPositionRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'position', 'create')) {
    throw Errors.FORBIDDEN()
  }
  const body = c.req.valid('json')
  
  const result = await c.var.services.position.createPosition({
    code: body.code,
    name: body.name,
    level: body.level,
    functionRole: body.functionRole ?? body.function_role ?? '',
    canManageSubordinates: body.canManageSubordinates ?? body.can_manage_subordinates,
    description: body.description,
    permissions: typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions ?? {}),
    sortOrder: body.sortOrder ?? body.sort_order,
  })

  logAuditAction(c, 'create', 'position', result.id, JSON.stringify({ code: result.code, name: result.name }))
  return { id: result.id, ...result }
}) as any)

// Update Position
const updatePositionRoute = createRoute({
  method: 'put',
  path: '/position-permissions/{id}',
  tags: ['Position Permissions'],
  summary: 'Update position',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updatePositionSchema,
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
            data: positionResponseSchema.partial().and(z.object({ id: z.string() })),
          }),
        },
      },
      description: 'Updated position',
    },
  },
})

positionPermissionsRoutes.openapi(updatePositionRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'position', 'update')) {
    throw Errors.FORBIDDEN()
  }
  const id = c.req.param('id')
  if (!id) {
    throw Errors.VALIDATION_ERROR('Position ID is required')
  }
  const body = c.req.valid('json')

  await c.var.services.position.updatePosition(id, {
    code: body.code,
    name: body.name,
    level: body.level,
    functionRole: body.functionRole ?? body.function_role,
    canManageSubordinates: body.canManageSubordinates ?? body.can_manage_subordinates,
    description: body.description,
    permissions: typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions),
    sortOrder: body.sortOrder ?? body.sort_order,
    active: body.active,
  })

  logAuditAction(c, 'update', 'position', id, JSON.stringify({ code: body.code, name: body.name }))
  const updated = await c.var.services.position.getPositions()
  const position = updated.find((p: any) => p.id === id)
  return position || { id }
}) as any)

// Delete Position
const deletePositionRoute = createRoute({
  method: 'delete',
  path: '/position-permissions/{id}',
  tags: ['Position Permissions'],
  summary: 'Delete position',
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
            data: z.object({ success: z.boolean() }),
          }),
        },
      },
      description: 'Success',
    },
  },
})

positionPermissionsRoutes.openapi(deletePositionRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'position', 'delete')) {
    throw Errors.FORBIDDEN()
  }
  const id = c.req.param('id')
  if (!id) {
    throw Errors.VALIDATION_ERROR('Position ID is required')
  }

  const result = await c.var.services.position.deletePosition(id)
  logAuditAction(c, 'delete', 'position', id, JSON.stringify({ name: result.name }))
  return { success: true }
}) as any)
