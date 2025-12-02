import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createPositionSchema, updatePositionSchema } from '../schemas/business.schema.js'

export const positionPermissionsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const positionResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  level: z.number(),
  function_role: z.string(),
  permissions: z.any(),
  description: z.string().nullable(),
  sort_order: z.number(),
  active: z.number(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable(),
})

const positionListSchema = z.object({
  results: z.array(positionResponseSchema)
})

// Routes

// Get All Positions
positionPermissionsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/position-permissions',
    tags: ['Position Permissions'],
    summary: 'Get all positions',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: positionListSchema,
          },
        },
        description: 'Position list',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'position', 'view')) throw Errors.FORBIDDEN()
    const results = await c.get('services').position.getPositions()
    return c.json({ results })
  }
)

// Get Position
positionPermissionsRoutes.openapi(
  createRoute({
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
            schema: positionResponseSchema,
          },
        },
        description: 'Position details',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'position', 'view')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const result = await c.get('services').position.getPosition(id)
    return c.json(result)
  }
)

// Create Position
positionPermissionsRoutes.openapi(
  createRoute({
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
            schema: positionResponseSchema.partial().and(z.object({ id: z.string() })),
          },
        },
        description: 'Created position',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'position', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').position.createPosition(body)

    logAuditAction(c, 'create', 'position', result.id, JSON.stringify(body))

    return c.json(result)
  }
)

// Update Position
positionPermissionsRoutes.openapi(
  createRoute({
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
            schema: positionResponseSchema.partial().and(z.object({ id: z.string() })),
          },
        },
        description: 'Updated position',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'position', 'update')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = c.req.valid('json')

    const result = await c.get('services').position.updatePosition(id, body)

    logAuditAction(c, 'update', 'position', id, JSON.stringify(body))

    return c.json(result)
  }
)

// Delete Position
positionPermissionsRoutes.openapi(
  createRoute({
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
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: 'Success',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'position', 'delete')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')

    await c.get('services').position.deletePosition(id)

    logAuditAction(c, 'delete', 'position', id)

    return c.json({ success: true })
  }
)
