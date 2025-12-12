import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getDataAccessFilter } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createArApDocSchema, createSettlementSchema, confirmArApDocSchema, idQuerySchema } from '../schemas/business.schema.js'
import { docIdQuerySchema, paginationSchema } from '../schemas/common.schema.js'

export const ar_apRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// 定义 Schema
const arApDocResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['AR', 'AP']),
  docNo: z.string().nullable(),
  partyId: z.string().nullable(),
  siteId: z.string().nullable(),
  departmentId: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  amountCents: z.number(),
  status: z.string(),
  memo: z.string().nullable(),
  createdAt: z.number().nullable()
})

const listArApDocsResponseSchema = z.object({
  total: z.number(),
  results: z.array(arApDocResponseSchema.extend({
    settledCents: z.number(),
    siteName: z.string().nullable()
  }))
})

const settlementResponseSchema = z.object({
  id: z.string(),
  docId: z.string(),
  flowId: z.string(),
  settleAmountCents: z.number(),
  settleDate: z.string().nullable(),
  createdAt: z.number().nullable()
})

const listSettlementsResponseSchema = z.object({
  results: z.array(settlementResponseSchema)
})

const statementResponseSchema = z.object({
  doc: arApDocResponseSchema,
  settlements: z.array(settlementResponseSchema),
  settledCents: z.number(),
  remainingCents: z.number()
})

// Routes

// 列出 AR/AP 单据
ar_apRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ar/docs',
    summary: 'List AR/AP documents',
    request: {
      query: z.object({
        kind: z.enum(['AR', 'AP']).optional(),
        status: z.string().optional()
      }).merge(paginationSchema)
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listArApDocsResponseSchema
          }
        },
        description: 'List of AR/AP documents'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const { kind, status } = c.req.valid('query')

    const { where, binds: scopeBinds } = getDataAccessFilter(c, 'ar_ap_docs', { skipOrgDept: true })

    const conditions: any[] = []

    if (kind) conditions.push(sql`ar_ap_docs.kind = ${kind}`)
    if (status) conditions.push(sql`ar_ap_docs.status = ${status}`)

    if (where !== '1=1') {
      let scopeConditions = sql``
      const parts = where.split('?')
      parts.forEach((part, i) => {
        scopeConditions = scopeConditions.append(sql.raw(part))
        if (i < scopeBinds.length) {
          scopeConditions = scopeConditions.append(sql`${scopeBinds[i]}`)
        }
      })
      conditions.push(scopeConditions)
    }

    let whereClause = sql``
    if (conditions.length > 0) {
      conditions.forEach((cond, i) => {
        if (i > 0) whereClause = whereClause.append(sql` and `)
        whereClause = whereClause.append(cond)
      })
    } else {
      whereClause = sql`1=1`
    }

    const { page = 1, pageSize = 20 } = c.req.valid('query')

    const { total, list } = await c.var.services.arAp.list(page, pageSize, whereClause)

    const results = list.map(row => {
      const d = row.doc
      return {
        id: d.id,
        kind: d.kind,
        docNo: d.docNo,
        partyId: d.partyId,
        siteId: d.siteId,
        departmentId: d.departmentId,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        amountCents: d.amountCents,
        status: d.status,
        memo: d.memo,
        createdAt: d.createdAt,
        settledCents: row.settledCents,
        siteName: row.siteName
      }
    })

    return c.json({ total, results } as any)
  }
)

// 创建 AR/AP 单据
ar_apRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ar/docs',
    summary: 'Create AR/AP document',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createArApDocSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string(), docNo: z.string() })
          }
        },
        description: 'Created document ID and number'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.arAp.create({
      kind: body.kind,
      amountCents: body.amountCents,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      partyId: body.partyId,
      siteId: body.siteId,
      departmentId: body.departmentId,
      memo: body.memo,
      docNo: body.docNo
    })

    logAuditAction(c, 'create', 'ar_ap_doc', result.id, JSON.stringify({ kind: body.kind, docNo: result.docNo, amountCents: body.amountCents }))
    return c.json({ id: result.id, docNo: result.docNo })
  }
)

// 列出结算记录
ar_apRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ar/settlements',
    summary: 'List settlements for a document',
    request: {
      query: docIdQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listSettlementsResponseSchema
          }
        },
        description: 'List of settlements'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const { docId } = c.req.valid('query')

    const service = c.var.services.arAp
    const rows = await service.getSettlements(docId)
    return c.json({ results: rows } as any)
  }
)

// 创建结算
ar_apRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ar/settlements',
    summary: 'Create settlement',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createSettlementSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string() })
          }
        },
        description: 'Created settlement ID'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.arAp.settle({
      docId: body.docId,
      flowId: body.flowId,
      amountCents: body.settleAmountCents,
      settleDate: body.settleDate
    })

    logAuditAction(c, 'settle', 'ar_ap_doc', body.docId, JSON.stringify({ settlement_id: result.id, amountCents: body.settleAmountCents }))
    return c.json({ id: result.id })
  }
)

// 账单详情
ar_apRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ar/statement',
    summary: 'Get document statement',
    request: {
      query: docIdQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: statementResponseSchema
          }
        },
        description: 'Document statement'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const { docId } = c.req.valid('query')

    // 优化：并行查询文档和settlements
    const service = c.var.services.arAp

    const [doc, settlements] = await Promise.all([
      service.getById(docId),
      service.getSettlements(docId)
    ])

    if (!doc) throw Errors.NOT_FOUND('Document')

    const settled = settlements.reduce((sum, s) => sum + s.settleAmountCents, 0)
    const remaining = (doc?.amountCents ?? 0) - settled

    return c.json({
      doc: doc,
      settlements: settlements,
      settledCents: settled,
      remainingCents: remaining
    } as any)
  }
)

// 确认 AR/AP 单据
ar_apRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/ar/confirm',
    summary: 'Confirm AR/AP document',
    request: {
      body: {
        content: {
          'application/json': {
            schema: confirmArApDocSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), flowId: z.string(), voucherNo: z.string() })
          }
        },
        description: 'Confirmation result'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.arAp.confirm({
      docId: body.docId,
      accountId: body.accountId,
      bizDate: body.bizDate,
      categoryId: body.categoryId,
      method: body.method,
      voucherUrl: body.voucherUrl,
      createdBy: c.get('userId'),
      memo: body.memo
    })

    logAuditAction(c, 'confirm', 'ar_ap_doc', body.docId, JSON.stringify({
      flowId: result.flowId, voucherNo: result.voucherNo
    }))

    return c.json({ ok: true, flowId: result.flowId, voucherNo: result.voucherNo })
  }
)

// ================= 报表 V1 =================
// 项目现金汇总
