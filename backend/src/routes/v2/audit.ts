import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { getBusinessDate, formatBusinessTime } from '../../utils/timezone.js'
import { Errors } from '../../utils/errors.js'
import { auditLogQuerySchema } from '../../schemas/common.schema.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const auditRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：检查权限并返回 PermissionContext
 * 如果没有权限则抛出 FORBIDDEN 错误
 */
function requireAuditPermission(c: any, action: string): NonNullable<ReturnType<typeof createPermissionContext>> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission(PermissionModule.SYSTEM, 'audit', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

/**
 * 辅助函数：仅检查认证，不检查具体权限
 */
function requireAuthenticated(c: any): NonNullable<ReturnType<typeof createPermissionContext>> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.UNAUTHORIZED()
  }
  return permCtx
}

// Schema 定义
const auditLogItemSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  action: z.string().nullable(),
  entity: z.string().nullable(),
  entityId: z.string().nullable(),
  at: z.number(),
  detail: z.string().nullable(),
  ip: z.string().nullable(),
  ipLocation: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
})

// 获取审计日志
const getAuditLogsRoute = createRoute({
  method: 'get',
  path: '/audit-logs',
  tags: ['Audit'],
  summary: 'Get audit logs',
  request: {
    query: auditLogQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(auditLogItemSchema),
              total: z.number(),
            }),
          }),
        },
      },
      description: 'Audit logs list',
    },
  },
})

auditRoutes.openapi(getAuditLogsRoute, createRouteHandler(async (c: any) => {
  // 使用 PermissionContext 检查权限
  requireAuditPermission(c, PermissionAction.VIEW)

  const query = c.req.valid('query')
  return await c.var.services.audit.getAuditLogs(query)
}) as any)

// 获取审计日志过滤选项
const getAuditLogOptionsRoute = createRoute({
  method: 'get',
  path: '/audit-logs/options',
  tags: ['Audit'],
  summary: 'Get audit log filter options',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              actions: z.array(z.string()),
              entities: z.array(z.string()),
              actors: z.array(
                z.object({
                  id: z.string(),
                  name: z.string().nullable(),
                  email: z.string().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: 'Audit log options',
    },
  },
})

auditRoutes.openapi(getAuditLogOptionsRoute, createRouteHandler(async c => {
  // 使用 PermissionContext 检查权限
  requireAuditPermission(c, PermissionAction.VIEW)

  return await c.var.services.audit.getAuditLogOptions()
}))

// 导出审计日志
const exportAuditLogsRoute = createRoute({
  method: 'get',
  path: '/audit-logs/export',
  tags: ['Audit'],
  summary: 'Export audit logs',
  request: {
    query: auditLogQuerySchema,
  },
  responses: {
    200: {
      description: 'CSV file',
    },
  },
})

auditRoutes.openapi(exportAuditLogsRoute, async c => {
  // 使用 PermissionContext 检查权限
  requireAuditPermission(c, 'export')

  const query = c.req.valid('query')
  const exportQuery = { ...query, limit: 10000, offset: 0 }
  const { results } = await c.var.services.audit.getAuditLogs(exportQuery)

  const headers = [
    '时间',
    '操作人',
    '邮箱',
    '操作',
    '实体类型',
    '实体ID',
    'IP地址',
    'IP归属地',
    '详情',
  ]
  const csvRows = [headers.join(',')]

  for (const row of results) {
    const time = formatBusinessTime(row.at)
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) { return '' }
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    csvRows.push(
      [
        escapeCsv(time),
        escapeCsv(row.actorName || ''),
        escapeCsv(row.actorEmail || ''),
        escapeCsv(row.action),
        escapeCsv(row.entity),
        escapeCsv(row.entityId || ''),
        escapeCsv(row.ip || ''),
        escapeCsv(row.ipLocation || ''),
        escapeCsv(row.detail || ''),
      ].join(',')
    )
  }

  const csv = '\uFEFF' + csvRows.join('\n')

  logAuditAction(c, 'export', 'audit_log', undefined, JSON.stringify({ count: results.length }))

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-logs-${getBusinessDate()}.csv"`,
    },
  })
})

// 创建审计日志
const createAuditLogSchema = z.object({
  action: z.string(),
  entity: z.string(),
  entityId: z.string().optional(),
  detail: z.string().optional(),
})

const createAuditLogRoute = createRoute({
  method: 'post',
  path: '/audit-logs',
  tags: ['Audit'],
  summary: 'Create audit log',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createAuditLogSchema,
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
      description: 'Audit log created',
    },
  },
})

auditRoutes.openapi(createAuditLogRoute, createRouteHandler(async (c: any) => {
  // 使用 PermissionContext 检查认证
  requireAuthenticated(c)

  const body = c.req.valid('json') as { action: string; entity: string; entityId?: string; detail?: string }

  logAuditAction(c, body.action, body.entity, body.entityId, body.detail)

  return { ok: true }
}) as any)
