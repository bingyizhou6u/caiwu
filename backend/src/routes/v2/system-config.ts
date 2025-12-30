import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { updateSystemConfigSchema } from '../../schemas/business.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const systemConfigRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：检查权限并返回 PermissionContext
 * 如果没有权限则抛出 FORBIDDEN 错误
 */
function requireConfigPermission(c: any, action: string): NonNullable<ReturnType<typeof createPermissionContext>> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission(PermissionModule.SYSTEM, 'config', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

// Schema Definitions
const SystemConfigSchema = z.object({
  key: z.string(),
  value: z.any(),
  description: z.string().nullable().optional(),
})

const ConfigResponseSchema = z.object({
  config: z.record(z.any()),
})

const BooleanResponseSchema = z.object({
  enabled: z.boolean(),
})

// GET /system-config/email-notification/enabled
const getEmailNotificationEnabledRoute = createRoute({
  method: 'get',
  path: '/system-config/email-notification/enabled',
  summary: 'Check if email notification is enabled',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: BooleanResponseSchema,
          }),
        },
      },
      description: 'Status of email notification',
    },
  },
})

systemConfigRoutes.openapi(
  getEmailNotificationEnabledRoute,
  createRouteHandler(async (c: any) => {
    const service = c.var.services.systemConfig
    if (!service) {
      throw Errors.INTERNAL_ERROR('Service not initialized')
    }

    const config = await service.get('email_notification_enabled')
    const enabled = config?.value === true || config?.value === 'true'
    return { enabled }
  }) as any
)

// GET /system-config
const getSystemConfigRoute = createRoute({
  method: 'get',
  path: '/system-config',
  summary: 'Get all system configurations',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: ConfigResponseSchema,
          }),
        },
      },
      description: 'All system configurations',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.any().optional(),
            }),
          }),
        },
      },
      description: 'Forbidden',
    },
  },
})

systemConfigRoutes.openapi(
  getSystemConfigRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireConfigPermission(c, PermissionAction.VIEW)

    const service = c.var.services.systemConfig
    const results = await service.getAll()

    const config: Record<string, any> = {}
    for (const row of results) {
      config[row.key] = row.value
    }
    return { config }
  }) as any
)

// PUT /system-config/:key
const updateSystemConfigRoute = createRoute({
  method: 'put',
  path: '/system-config/{key}',
  summary: 'Update a system configuration',
  request: {
    params: z.object({
      key: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateSystemConfigSchema,
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
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Update successful',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.any().optional(),
            }),
          }),
        },
      },
      description: 'Forbidden',
    },
  },
})

systemConfigRoutes.openapi(
  updateSystemConfigRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    const permCtx = requireConfigPermission(c, PermissionAction.UPDATE)

    const key = c.req.param('key')
    if (!key) {
      throw Errors.VALIDATION_ERROR('Config key is required')
    }
    const body = c.req.valid('json') as { value: any; description?: string | null }

    const userId = permCtx.employee.id

    const service = c.var.services.systemConfig

    await service.set(key, body.value, body.description ?? null, userId ?? 'system')

    logAuditAction(c, 'update', 'system_config', key, JSON.stringify({ key, value: body.value }))
    return { ok: true }
  }) as any
)

// GET /system-config/:key
const getSystemConfigByKeyRoute = createRoute({
  method: 'get',
  path: '/system-config/{key}',
  summary: 'Get a specific system configuration',
  request: {
    params: z.object({
      key: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: SystemConfigSchema,
          }),
        },
      },
      description: 'Configuration details',
      404: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              error: z.object({
                code: z.string(),
                message: z.string(),
                details: z.any().optional(),
              }),
            }),
          },
        },
        description: 'Configuration not found',
      },
    },
  },
})

systemConfigRoutes.openapi(
  getSystemConfigByKeyRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireConfigPermission(c, PermissionAction.VIEW)

    const key = c.req.param('key')
    if (!key) {
      throw Errors.VALIDATION_ERROR('Config key is required')
    }
    const service = c.var.services.systemConfig
    const config = await service.get(key)

    if (!config) {
      throw Errors.NOT_FOUND()
    }

    return { key: config.key, value: config.value, description: config.description }
  }) as any
)

// ==================== Access Policy Sync ====================

import { AccessPolicySyncService } from '../../services/system/AccessPolicySyncService.js'

/**
 * 同步员工邮箱到 Cloudflare Access 策略
 * 仅 hq_admin 可操作
 */
const syncAccessPolicyRoute = createRoute({
  method: 'post',
  path: '/system-config/sync-access-policy',
  summary: 'Sync employee emails to Cloudflare Access policy',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              synced: z.number(),
            }).optional(),
            error: z.string().optional(),
          }),
        },
      },
      description: 'Sync result',
    },
  },
})

systemConfigRoutes.openapi(
  syncAccessPolicyRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限 - 仅 hq_admin 可操作
    requireConfigPermission(c, 'manage')

    const db = c.var.db
    const syncService = new AccessPolicySyncService(db, c.env.CF_ACCESS_TOKEN)

    const result = await syncService.syncAllEmployeeEmails()

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // 记录审计日志
    logAuditAction(c, 'access_policy_sync', 'sync', undefined, JSON.stringify({ synced: result.synced }))

    return { synced: result.synced }
  }) as any
)

