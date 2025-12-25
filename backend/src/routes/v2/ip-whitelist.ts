import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import {
  createIPWhitelistSchema,
  batchCreateIPWhitelistSchema,
  batchDeleteIPWhitelistSchema,
  toggleIPWhitelistRuleSchema,
} from '../../schemas/business.schema.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const ipWhitelistRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const ipWhitelistItemSchema = z.object({
  id: z.string(),
  ipAddress: z.string(),
  description: z.string().nullable(),
  cloudflareRuleId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const batchAddResponseSchema = z.object({
  success: z.boolean(),
  successCount: z.number(),
  failedCount: z.number(),
  errors: z
    .array(
      z.object({
        ip: z.string(),
        error: z.string(),
      })
    )
    .optional(),
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

// 获取 IP 白名单
const getIPWhitelistRoute = createRoute({
  method: 'get',
  path: '/ip-whitelist',
  tags: ['IP Whitelist'],
  summary: 'Get IP whitelist',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(ipWhitelistItemSchema),
            }),
          }),
        },
      },
      description: 'IP whitelist items',
    },
  },
})

ipWhitelistRoutes.openapi(getIPWhitelistRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const items = await c.var.services.ipWhitelist.getIPList()
  return { results: items }
}))

// 创建 IP 白名单项
const createIPWhitelistRoute = createRoute({
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
          schema: z.object({
            success: z.boolean(),
            data: ipWhitelistItemSchema,
          }),
        },
      },
      description: 'Created IP whitelist item',
    },
  },
})

ipWhitelistRoutes.openapi(createIPWhitelistRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const body = c.req.valid('json') as { ipAddress: string; description?: string }

  const result = await c.var.services.ipWhitelist.addIP(body.ipAddress, body.description)

  logAuditAction(
    c,
    'create',
    'ip_whitelist',
    result.id,
    JSON.stringify({ ipAddress: body.ipAddress })
  )

  return result
}) as any)

// 批量添加 IP
const batchAddIPWhitelistRoute = createRoute({
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
          schema: z.object({
            success: z.boolean(),
            data: batchAddResponseSchema,
          }),
        },
      },
      description: 'Batch add result',
    },
  },
})

ipWhitelistRoutes.openapi(batchAddIPWhitelistRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const body = c.req.valid('json') as { ips: string[] }

  const result = await c.var.services.ipWhitelist.batchAddIPs(body.ips)

  logAuditAction(
    c,
    'batch_create',
    'ip_whitelist',
    '',
    JSON.stringify({
      count: body.ips.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
    })
  )

  return result
}) as any)

// 批量删除 IP
const batchDeleteIPWhitelistRoute = createRoute({
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
          schema: z.object({
            success: z.boolean(),
            data: batchDeleteResponseSchema,
          }),
        },
      },
      description: 'Batch delete result',
    },
  },
})

ipWhitelistRoutes.openapi(batchDeleteIPWhitelistRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const body = c.req.valid('json') as { ids: string[] }

  const result = await c.var.services.ipWhitelist.batchDeleteIPs(body.ids)

  logAuditAction(
    c,
    'batch_delete',
    'ip_whitelist',
    '',
    JSON.stringify({
      count: body.ids.length,
      successCount: result.successCount,
      failedCount: result.failedCount,
      deletedIds: body.ids,
    })
  )

  return result
}) as any)

// 同步 IP
const syncIPWhitelistRoute = createRoute({
  method: 'post',
  path: '/ip-whitelist/sync',
  tags: ['IP Whitelist'],
  summary: 'Sync IPs from Cloudflare',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              message: z.string(),
              synced: z.number(),
            }),
          }),
        },
      },
      description: 'Sync result',
    },
  },
})

ipWhitelistRoutes.openapi(syncIPWhitelistRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }

  const items = await c.var.services.ipWhitelist.getIPList()

  logAuditAction(c, 'sync', 'ip_whitelist', '', JSON.stringify({ count: items.length }))
  return { message: 'sync completed', synced: items.length }
}))

// 删除 IP
const deleteIPWhitelistRoute = createRoute({
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
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Success',
    },
  },
})

ipWhitelistRoutes.openapi(deleteIPWhitelistRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const id = c.req.param('id')

  await c.var.services.ipWhitelist.deleteIP(id)

  logAuditAction(c, 'delete', 'ip_whitelist', id)
  return { ok: true }
}))

// 获取规则状态
const getIPWhitelistRuleStatusRoute = createRoute({
  method: 'get',
  path: '/ip-whitelist/rule',
  tags: ['IP Whitelist'],
  summary: 'Get whitelist rule status',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ruleStatusSchema,
          }),
        },
      },
      description: 'Rule status',
    },
  },
})

ipWhitelistRoutes.openapi(getIPWhitelistRuleStatusRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  return await c.var.services.ipWhitelist.getRuleStatus()
}))

// 切换规则
const toggleIPWhitelistRuleRoute = createRoute({
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
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean(), enabled: z.boolean() }),
          }),
        },
      },
      description: 'Toggle result',
    },
  },
})

ipWhitelistRoutes.openapi(toggleIPWhitelistRuleRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const body = c.req.valid('json') as { enabled: boolean }

  const result = await c.var.services.ipWhitelist.toggleRule(body.enabled)

  logAuditAction(c, 'update', 'ip_whitelist_rule', '', JSON.stringify({ enabled: body.enabled }))
  return result
}) as any)

// 创建规则
const createIPWhitelistRuleRoute = createRoute({
  method: 'post',
  path: '/ip-whitelist/rule/create',
  tags: ['IP Whitelist'],
  summary: 'Create whitelist rule',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              ok: z.boolean(),
              ruleId: z.string().optional(),
              rulesetId: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Create result',
    },
  },
})

ipWhitelistRoutes.openapi(createIPWhitelistRuleRoute, createRouteHandler(async c => {
  if (!hasPermission(c, 'system', 'config', 'update')) {
      throw Errors.FORBIDDEN()
    }
  const result = await c.var.services.ipWhitelist.createRule()
  logAuditAction(c, 'create', 'ip_whitelist_rule', result.ruleId || '')
  return result
}) as any)
