import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { updateSystemConfigSchema } from '../schemas/business.schema.js'

export const systemConfigRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schema Definitions
const SystemConfigSchema = z.object({
  key: z.string(),
  value: z.any(),
  description: z.string().nullable().optional()
})

const ConfigResponseSchema = z.object({
  config: z.record(z.any())
})

const BooleanResponseSchema = z.object({
  enabled: z.boolean()
})

const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.any().optional()
})

// Routes

// GET /system-config/email-notification/enabled
systemConfigRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/system-config/email-notification/enabled',
    summary: 'Check if email notification is enabled',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: BooleanResponseSchema
          }
        },
        description: 'Status of email notification'
      }
    }
  }),
  async (c) => {
    const service = c.get('services')?.systemConfig
    if (!service) throw Errors.INTERNAL_ERROR('Service not initialized')

    const config = await service.get('email_notification_enabled')
    const enabled = config?.value === true || config?.value === 'true'
    return c.json({ enabled }, 200)
  }
)

// GET /system-config
systemConfigRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/system-config',
    summary: 'Get all system configurations',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: ConfigResponseSchema
          }
        },
        description: 'All system configurations'
      },
      403: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema
          }
        },
        description: 'Forbidden'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'view')) throw Errors.FORBIDDEN()

    const service = c.get('services').systemConfig
    const results = await service.getAll()

    const config: Record<string, any> = {}
    for (const row of results) {
      config[row.key] = row.value
    }
    return c.json({ config }, 200)
  }
)

// PUT /system-config/:key
systemConfigRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/system-config/{key}',
    summary: 'Update a system configuration',
    request: {
      params: z.object({
        key: z.string()
      }),
      body: {
        content: {
          'application/json': {
            schema: updateSystemConfigSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        },
        description: 'Update successful'
      },
      403: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema
          }
        },
        description: 'Forbidden'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

    const key = c.req.param('key')
    const body = c.req.valid('json')

    const userId = c.get('userId') as string | undefined

    const service = c.get('services').systemConfig

    await service.set(key, body.value, body.description ?? null, userId ?? 'system')

    logAuditAction(c, 'update', 'system_config', key, JSON.stringify({ key, value: body.value }))
    return c.json({ ok: true }, 200)
  }
)

// GET /system-config/:key
systemConfigRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/system-config/{key}',
    summary: 'Get a specific system configuration',
    request: {
      params: z.object({
        key: z.string()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: SystemConfigSchema
          }
        },
        description: 'Configuration details'
      },
      404: {
        content: {
          'application/json': {
            schema: ErrorResponseSchema
          }
        },
        description: 'Configuration not found'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'view')) throw Errors.FORBIDDEN()

    const key = c.req.param('key')
    const service = c.get('services').systemConfig
    const config = await service.get(key)

    if (!config) {
      throw Errors.NOT_FOUND()
    }

    return c.json({ key: config.key, value: config.value, description: config.description }, 200)
  }
)
