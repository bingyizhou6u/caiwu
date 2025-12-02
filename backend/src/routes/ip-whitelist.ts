import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import {
  createIPWhitelistSchema,
  batchCreateIPWhitelistSchema,
  batchDeleteIPWhitelistSchema,
  toggleIPWhitelistRuleSchema
} from '../schemas/business.schema.js'

export const ip_whitelistRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const ipWhitelistItemSchema = z.object({
  id: z.string(),
  ip_address: z.string(),
  description: z.string().nullable(),
  cloudflare_rule_id: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
})

const ipWhitelistListSchema = z.array(ipWhitelistItemSchema)

const batchAddResponseSchema = z.object({
  success: z.boolean(),
  successCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.object({
    ip: z.string(),
    error: z.string()
  })).optional()
})

const batchDeleteResponseSchema = z.object({
  success: z.boolean(),
  successCount: z.number(),
  failedCount: z.number(),
})

const ruleStatusSchema = z.object({
  enabled: z.boolean(),
  ruleId: z.string().optional(),
  rulesetId: z.string().optional(),
})

// Routes

// Get IP Whitelist
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ip-whitelist',
    tags: ['IP Whitelist'],
    summary: 'Get IP whitelist',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: ipWhitelistListSchema,
          },
        },
        description: 'IP whitelist items',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const items = await c.get('services').ipWhitelist.getIPList()
    return c.json(items)
  }
)

// Create IP Whitelist Item
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ip-whitelist',
    tags: ['IP Whitelist'],
    summary: 'Add IP to whitelist',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createIPWhitelistSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: ipWhitelistItemSchema,
          },
        },
        description: 'Created IP whitelist item',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').ipWhitelist.addIP(body.ip_address, body.description)

    logAuditAction(c, 'create', 'ip_whitelist', result.id, JSON.stringify({ ip_address: body.ip_address }))

    return c.json(result)
  }
)

// Batch Add IPs
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ip-whitelist/batch',
    tags: ['IP Whitelist'],
    summary: 'Batch add IPs to whitelist',
    request: {
      body: {
        content: {
          'application/json': {
            schema: batchCreateIPWhitelistSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: batchAddResponseSchema,
          },
        },
        description: 'Batch add result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').ipWhitelist.batchAddIPs(body.ips)

    logAuditAction(c, 'batch_create', 'ip_whitelist', '', JSON.stringify({
      count: body.ips.length,
      successCount: result.successCount,
      failedCount: result.failedCount
    }))

    return c.json(result)
  }
)

// Batch Delete IPs
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/ip-whitelist/batch',
    tags: ['IP Whitelist'],
    summary: 'Batch delete IPs from whitelist',
    request: {
      body: {
        content: {
          'application/json': {
            schema: batchDeleteIPWhitelistSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: batchDeleteResponseSchema,
          },
        },
        description: 'Batch delete result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').ipWhitelist.batchDeleteIPs(body.ids)

    logAuditAction(c, 'batch_delete', 'ip_whitelist', '', JSON.stringify({
      count: body.ids.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      deletedIds: body.ids
    }))

    return c.json(result)
  }
)

// Sync IPs (Just fetch and return count, as we don't store in DB anymore)
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ip-whitelist/sync',
    tags: ['IP Whitelist'],
    summary: 'Sync IPs from Cloudflare',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              synced: z.number(),
            }),
          },
        },
        description: 'Sync result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()

    const items = await c.get('services').ipWhitelist.getIPList()

    logAuditAction(c, 'sync', 'ip_whitelist', '', JSON.stringify({ count: items.length }))
    return c.json({ message: 'sync completed', synced: items.length })
  }
)

// Delete IP
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/ip-whitelist/{id}',
    tags: ['IP Whitelist'],
    summary: 'Delete IP from whitelist',
    request: {
      params: z.object({
        id: z.string(),
      }),
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
    const id = c.req.param('id')

    await c.get('services').ipWhitelist.deleteIP(id)

    logAuditAction(c, 'delete', 'ip_whitelist', id)
    return c.json({ ok: true })
  }
)

// Get Rule Status
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ip-whitelist/rule',
    tags: ['IP Whitelist'],
    summary: 'Get whitelist rule status',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: ruleStatusSchema,
          },
        },
        description: 'Rule status',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const status = await c.get('services').ipWhitelist.getRuleStatus()
    return c.json(status)
  }
)

// Toggle Rule
ip_whitelistRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ip-whitelist/rule/toggle',
    tags: ['IP Whitelist'],
    summary: 'Toggle whitelist rule',
    request: {
      body: {
        content: {
          'application/json': {
            schema: toggleIPWhitelistRuleSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), enabled: z.boolean() }),
          },
        },
        description: 'Toggle result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.get('services').ipWhitelist.toggleRule(body.enabled)

    logAuditAction(c, 'update', 'ip_whitelist_rule', '', JSON.stringify({ enabled: body.enabled }))
    return c.json(result)
  }
)
