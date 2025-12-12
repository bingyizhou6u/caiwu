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

export const ipWhitelistRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schema 定义
const ipWhitelistItemSchema = z.object({
  id: z.string(),
  ipAddress: z.string(),
  description: z.string().nullable(),
  cloudflareRuleId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
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

// 路由

// 获取 IP 白名单
ipWhitelistRoutes.openapi(
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
    const items = await c.var.services.ipWhitelist.getIPList()
    return c.json(items)
  }
)

// 创建 IP 白名单项
ipWhitelistRoutes.openapi(
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

    const result = await c.var.services.ipWhitelist.addIP(body.ipAddress, body.description)

    logAuditAction(c, 'create', 'ip_whitelist', result.id, JSON.stringify({ ipAddress: body.ipAddress }))

    return c.json(result)
  }
)

// 批量添加 IP
ipWhitelistRoutes.openapi(
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

    const result = await c.var.services.ipWhitelist.batchAddIPs(body.ips)

    logAuditAction(c, 'batch_create', 'ip_whitelist', '', JSON.stringify({
      count: body.ips.length,
      successCount: result.successCount,
      failedCount: result.failedCount
    }))

    return c.json(result)
  }
)

// 批量删除 IP
ipWhitelistRoutes.openapi(
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

    const result = await c.var.services.ipWhitelist.batchDeleteIPs(body.ids)

    logAuditAction(c, 'batch_delete', 'ip_whitelist', '', JSON.stringify({
      count: body.ids.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      deletedIds: body.ids
    }))

    return c.json(result)
  }
)

// 同步 IP（仅获取并返回数量，不再存储在 DB 中）
ipWhitelistRoutes.openapi(
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

    const items = await c.var.services.ipWhitelist.getIPList()

    logAuditAction(c, 'sync', 'ip_whitelist', '', JSON.stringify({ count: items.length }))
    return c.json({ message: 'sync completed', synced: items.length })
  }
)

// 删除 IP
ipWhitelistRoutes.openapi(
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

    await c.var.services.ipWhitelist.deleteIP(id)

    logAuditAction(c, 'delete', 'ip_whitelist', id)
    return c.json({ ok: true })
  }
)

// 获取规则状态
ipWhitelistRoutes.openapi(
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
    const status = await c.var.services.ipWhitelist.getRuleStatus()
    return c.json(status)
  }
)

// 切换规则
ipWhitelistRoutes.openapi(
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

    const result = await c.var.services.ipWhitelist.toggleRule(body.enabled)

    logAuditAction(c, 'update', 'ip_whitelist_rule', '', JSON.stringify({ enabled: body.enabled }))
    return c.json(result)
  }
)

// 创建规则
ipWhitelistRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ip-whitelist/rule/create',
    tags: ['IP Whitelist'],
    summary: 'Create whitelist rule',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), ruleId: z.string().optional(), rulesetId: z.string().optional() }),
          },
        },
        description: 'Create result',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'config', 'update')) throw Errors.FORBIDDEN()
    const result = await c.var.services.ipWhitelist.createRule()
    logAuditAction(c, 'create', 'ip_whitelist_rule', result.ruleId || '')
    return c.json(result)
  }
)
