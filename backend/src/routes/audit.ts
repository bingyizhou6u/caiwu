import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { auditLogQuerySchema } from '../schemas/common.schema.js'

export const auditRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

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

const auditLogListSchema = z.object({
  results: z.array(auditLogItemSchema),
  total: z.number(),
})

const auditLogOptionsSchema = z.object({
  actions: z.array(z.string()),
  entities: z.array(z.string()),
  actors: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  })),
})

// Routes

// 获取审计日志
auditRoutes.openapi(
  createRoute({
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
            schema: auditLogListSchema,
          },
        },
        description: 'Audit logs list',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'audit', 'view')) throw Errors.FORBIDDEN()

    const query = c.req.valid('query')
    const result = await c.get('services').audit.getAuditLogs(query)
    return c.json(result)
  }
)

// 获取审计日志过滤选项
auditRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/audit-logs/options',
    tags: ['Audit'],
    summary: 'Get audit log filter options',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: auditLogOptionsSchema,
          },
        },
        description: 'Audit log options',
      },
    },
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'audit', 'view')) throw Errors.FORBIDDEN()

    const result = await c.get('services').audit.getAuditLogOptions()
    return c.json(result)
  }
)

// 导出审计日志
auditRoutes.openapi(
  createRoute({
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
  }),
  async (c) => {
    if (!hasPermission(c, 'system', 'audit', 'export')) throw Errors.FORBIDDEN()

    const query = c.req.valid('query')
    // 最多导出 10000 条记录
    const exportQuery = { ...query, limit: 10000, offset: 0 }
    const { results } = await c.get('services').audit.getAuditLogs(exportQuery)

    // 生成 CSV
    const headers = ['时间', '操作人', '邮箱', '操作', '实体类型', '实体ID', 'IP地址', 'IP归属地', '详情']
    const csvRows = [headers.join(',')]

    for (const row of results) {
      const time = new Date(row.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }
      csvRows.push([
        escapeCsv(time),
        escapeCsv(row.actorName || ''),
        escapeCsv(row.actorEmail || ''),
        escapeCsv(row.action),
        escapeCsv(row.entity),
        escapeCsv(row.entityId || ''),
        escapeCsv(row.ip || ''),
        escapeCsv(row.ipLocation || ''),
        escapeCsv(row.detail || '')
      ].join(','))
    }

    const csv = '\uFEFF' + csvRows.join('\n') // 添加 BOM 以适配 Excel

    logAuditAction(c, 'export', 'audit_log', undefined, JSON.stringify({ count: results.length }))

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    })
  }
)
