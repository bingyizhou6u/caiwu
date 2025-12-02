import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getDataAccessFilter } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createArApDocSchema, createSettlementSchema, confirmArApDocSchema, idQuerySchema } from '../schemas/business.schema.js'
import { docIdQuerySchema } from '../schemas/common.schema.js'

export const ar_apRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const arApDocResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['AR', 'AP']),
  doc_no: z.string().nullable(),
  party_id: z.string().nullable(),
  site_id: z.string().nullable(),
  department_id: z.string().nullable(),
  issue_date: z.string().nullable(),
  due_date: z.string().nullable(),
  amount_cents: z.number(),
  status: z.string(),
  memo: z.string().nullable(),
  created_at: z.number().nullable()
})

const listArApDocsResponseSchema = z.object({
  results: z.array(arApDocResponseSchema.extend({
    settled_cents: z.number(),
    site_name: z.string().nullable()
  }))
})

const settlementResponseSchema = z.object({
  id: z.string(),
  doc_id: z.string(),
  flow_id: z.string(),
  settle_amount_cents: z.number(),
  settle_date: z.string().nullable(),
  created_at: z.number().nullable()
})

const listSettlementsResponseSchema = z.object({
  results: z.array(settlementResponseSchema)
})

const statementResponseSchema = z.object({
  doc: arApDocResponseSchema,
  settlements: z.array(settlementResponseSchema),
  settled_cents: z.number(),
  remaining_cents: z.number()
})

// Routes

// List AR/AP Docs
ar_apRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ar/docs',
    summary: 'List AR/AP documents',
    request: {
      query: z.object({
        kind: z.enum(['AR', 'AP']).optional(),
        status: z.string().optional()
      })
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

    const { where, binds: scopeBinds } = getDataAccessFilter(c, 'ar_ap_docs')

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

    const rows = await c.var.services.finance.listArApDocs(200, whereClause)

    const results = rows.map(row => {
      const d = row.doc
      return {
        id: d.id,
        kind: d.kind,
        doc_no: d.docNo,
        party_id: d.partyId,
        site_id: d.siteId,
        department_id: d.departmentId,
        issue_date: d.issueDate,
        due_date: d.dueDate,
        amount_cents: d.amountCents,
        currency: d.currency,
        status: d.status,
        memo: d.memo,
        created_by: d.createdBy,
        created_at: d.createdAt,
        settled_cents: row.settledCents,
        site_name: row.siteName
      }
    })

    return c.json({ results } as any)
  }
)

// Create AR/AP Doc
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
            schema: z.object({ id: z.string(), doc_no: z.string() })
          }
        },
        description: 'Created document ID and number'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.finance.createArApDoc({
      kind: body.kind,
      amountCents: body.amount_cents,
      issueDate: body.issue_date,
      dueDate: body.due_date,
      partyId: body.party_id,
      siteId: body.site_id,
      departmentId: body.department_id,
      memo: body.memo,
      docNo: body.doc_no
    })

    logAuditAction(c, 'create', 'ar_ap_doc', result.id, JSON.stringify({ kind: body.kind, doc_no: result.docNo, amount_cents: body.amount_cents }))
    return c.json({ id: result.id, doc_no: result.docNo })
  }
)

// List Settlements
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
    const { doc_id } = c.req.valid('query')

    // TODO: Move to FinanceService
    const rows = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(doc_id).all()
    return c.json({ results: rows.results ?? [] } as any)
  }
)

// Create Settlement
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

    const result = await c.var.services.finance.settleArApDoc({
      docId: body.doc_id,
      flowId: body.flow_id,
      amountCents: body.settle_amount_cents,
      settleDate: body.settle_date
    })

    logAuditAction(c, 'settle', 'ar_ap_doc', body.doc_id, JSON.stringify({ settlement_id: result.id, amount_cents: body.settle_amount_cents }))
    return c.json({ id: result.id })
  }
)

// Statement
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
    const { doc_id } = c.req.valid('query')

    // 优化：并行查询文档和settlements
    const [doc, settlements] = await Promise.all([
      c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(doc_id).first<any>(),
      c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(doc_id).all<any>()
    ])

    if (!doc) throw Errors.NOT_FOUND('单据')

    const settled = (settlements.results ?? []).reduce((a: number, b: any) => a + (b.settle_amount_cents || 0), 0)
    const remaining = (doc?.amount_cents ?? 0) - settled

    return c.json({
      doc: doc,
      settlements: settlements.results ?? [],
      settled_cents: settled,
      remaining_cents: remaining
    } as any)
  }
)

// Confirm AR/AP Doc
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
            schema: z.object({ ok: z.boolean(), flow_id: z.string(), voucher_no: z.string() })
          }
        },
        description: 'Confirmation result'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'ar', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.finance.confirmArApDoc({
      docId: body.doc_id,
      accountId: body.account_id,
      bizDate: body.biz_date,
      categoryId: body.category_id,
      method: body.method,
      voucherUrl: body.voucher_url,
      createdBy: c.get('userId'),
      memo: body.memo
    })

    logAuditAction(c, 'confirm', 'ar_ap_doc', body.doc_id, JSON.stringify({
      flow_id: result.flowId, voucher_no: result.voucherNo
    }))

    return c.json({ ok: true, flow_id: result.flowId, voucher_no: result.voucherNo })
  }
)

// ================= Reports V1 =================
// Department cash summary
