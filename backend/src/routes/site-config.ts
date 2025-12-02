import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { updateSiteConfigSchema, batchUpdateSiteConfigSchema } from '../schemas/business.schema.js'

export const siteConfigRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const siteConfigItemSchema = z.object({
  id: z.string(),
  config_key: z.string(),
  config_value: z.string(),
  description: z.string().nullable(),
  is_encrypted: z.boolean(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable(),
})

const siteConfigListSchema = z.array(siteConfigItemSchema)

const batchUpdateResponseSchema = z.object({
  ok: z.boolean(),
  updated: z.number(),
  keys: z.array(z.string()).optional(),
})

// Routes

// Get All Configs
siteConfigRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/site-config',
    tags: ['Site Config'],
    summary: 'Get all site configs',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: siteConfigListSchema,
          },
        },
        description: 'Site config list',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'view')) throw Errors.FORBIDDEN()
    const configs = await c.get('services').siteConfig.getConfigs()
    return c.json(configs)
  }
)

// Update Config
siteConfigRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/site-config/{key}',
    tags: ['Site Config'],
    summary: 'Update site config',
    request: {
      params: z.object({
        key: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: updateSiteConfigSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: 'Success',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const key = c.req.param('key')
    const body = c.req.valid('json')

    await c.get('services').siteConfig.updateConfig(key, body.config_value)

    logAuditAction(c, 'update', 'site_config', key, JSON.stringify({ config_key: key }))

    return c.json({ ok: true })
  }
)

// Batch Update Configs
siteConfigRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/site-config',
    tags: ['Site Config'],
    summary: 'Batch update site configs',
    request: {
      body: {
        content: {
          'application/json': {
            schema: batchUpdateSiteConfigSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: batchUpdateResponseSchema,
          },
        },
        description: 'Batch update result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').siteConfig.batchUpdateConfigs(body)

    logAuditAction(c, 'update', 'site_config', 'batch', JSON.stringify({ keys: result.keys }))

    return c.json(result)
  }
)

// Export internal functions for use in other parts of the app (if needed)
// Note: In the original file, these were exported. 
// Since we moved logic to Service, other parts should use the Service.
// But if there are direct imports of these functions, we might break them.
// I should check if `getSiteConfigValue` or `getAllSiteConfig` are imported elsewhere.
// If so, I should update those imports to use the service, or re-export wrappers here (but that requires access to Env/DB which is tricky without context).
// Ideally, refactor consumers to use the service.

export default siteConfigRoutes
