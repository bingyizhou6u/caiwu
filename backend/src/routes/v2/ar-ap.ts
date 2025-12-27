import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission, getUserPosition, getDataAccessFilterSQL } from '../../utils/permissions.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import {
  createArApDocSchema,
  createSettlementSchema,
  confirmArApDocSchema,
} from '../../schemas/business.schema.js'
import { docIdQuerySchema, paginationSchema } from '../../schemas/common.schema.js'
import { apiSuccess, jsonResponse, apiPaged } from '../../utils/response.js'
import { getPagination } from '../../utils/pagination.js'
import { createRouteHandler, createPaginatedHandler, parsePagination } from '../../utils/route-helpers.js'

export const arApRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 定义 Schema
const arApDocResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['AR', 'AP']),
  docNo: z.string().nullable(),
  partyId: z.string().nullable(),
  siteId: z.string().nullable(),
  projectId: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  amountCents: z.number(),
  status: z.string(),
  memo: z.string().nullable(),
  createdAt: z.number().nullable(),
})

const arApDocWithExtrasSchema = arApDocResponseSchema.extend({
  settledCents: z.number(),
  siteName: z.string().nullable(),
})

const settlementResponseSchema = z.object({
  id: z.string(),
  docId: z.string(),
  flowId: z.string(),
  settleAmountCents: z.number(),
  settleDate: z.string().nullable(),
  createdAt: z.number().nullable(),
})

const statementResponseSchema = z.object({
  doc: arApDocResponseSchema,
  settlements: z.array(settlementResponseSchema),
  settledCents: z.number(),
  remainingCents: z.number(),
})

// 列出 AR/AP 单据
const listArApDocsRoute = createRoute({
  method: 'get',
  path: '/ar/docs',
  summary: 'List AR/AP documents',
  request: {
    query: z
      .object({
        kind: z.enum(['AR', 'AP']).optional(),
        status: z.string().optional(),
      })
      .merge(paginationSchema),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              items: z.array(arApDocWithExtrasSchema),
              pagination: z.object({
                page: z.number(),
                pageSize: z.number(),
                total: z.number(),
                totalPages: z.number(),
              }),
            }),
          }),
        },
      },
      description: 'List of AR/AP documents',
    },
  },
})

arApRoutes.openapi(
  listArApDocsRoute,
  createPaginatedHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { kind, status } = c.req.valid('query')
    const { page, limit } = parsePagination(c)

    const accessFilter = getDataAccessFilterSQL(c, 'ar_ap_docs', { skipOrgDept: true })

    const conditions: any[] = []

    if (kind) {
      conditions.push(sql`ar_ap_docs.kind = ${kind}`)
    }
    if (status) {
      conditions.push(sql`ar_ap_docs.status = ${status}`)
    }

    // 添加数据访问过滤条件（如果不是允许所有数据）
    // 检查是否是允许所有数据的条件（1=1）
    conditions.push(accessFilter)

    let whereClause = sql``
    if (conditions.length > 0) {
      conditions.forEach((cond, i) => {
        if (i > 0) {
          whereClause = whereClause.append(sql` and `)
        }
        whereClause = whereClause.append(cond)
      })
    } else {
      whereClause = sql`1=1`
    }

    const { total, list } = await c.var.services.arAp.list(page, limit, whereClause)

    const items = list.map((row: any) => {
      const d = row.doc
      return {
        id: d.id,
        kind: d.kind,
        docNo: d.docNo,
        partyId: d.partyId,
        siteId: d.siteId,
        projectId: d.projectId,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        amountCents: d.amountCents,
        status: d.status,
        memo: d.memo,
        createdAt: d.createdAt,
        settledCents: row.settledCents,
        siteName: row.siteName,
      }
    })

    return { items, total }
  }) as any
)

// 创建 AR/AP 单据
const createArApDocRoute = createRoute({
  method: 'post',
  path: '/ar/docs',
  summary: 'Create AR/AP document',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createArApDocSchema,
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
            data: z.object({
              id: z.string(),
              docNo: z.string(),
            }),
          }),
        },
      },
      description: 'Created document ID and number',
    },
  },
})

arApRoutes.openapi(createArApDocRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, PermissionModule.FINANCE, 'ar', PermissionAction.CREATE)) {
    throw Errors.FORBIDDEN()
  }
  const body = c.req.valid('json') as any

  const result = await c.var.services.arAp.create({
    kind: body.kind,
    amountCents: body.amountCents,
    issueDate: body.issueDate,
    dueDate: body.dueDate,
    partyId: body.partyId,
    siteId: body.siteId,
    projectId: body.projectId,
    memo: body.memo,
    docNo: body.docNo,
  })

  logAuditAction(
    c,
    'create',
    'ar_ap_doc',
    result.id,
    JSON.stringify({ kind: body.kind, docNo: result.docNo, amountCents: body.amountCents })
  )
  return { id: result.id, docNo: result.docNo }
}) as any)

// 列出结算记录
const listSettlementsRoute = createRoute({
  method: 'get',
  path: '/ar/settlements',
  summary: 'List settlements for a document',
  request: {
    query: docIdQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(settlementResponseSchema),
            }),
          }),
        },
      },
      description: 'List of settlements',
    },
  },
})

arApRoutes.openapi(
  listSettlementsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { docId } = c.req.valid('query')

    const service = c.var.services.arAp
    const rows = await service.getSettlements(docId)
    return { results: rows }
  }) as any
)

// 创建结算
const createSettlementRoute = createRoute({
  method: 'post',
  path: '/ar/settlements',
  summary: 'Create settlement',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createSettlementSchema,
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
            data: z.object({
              id: z.string(),
            }),
          }),
        },
      },
      description: 'Created settlement ID',
    },
  },
})

arApRoutes.openapi(
  createSettlementRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.FINANCE, 'ar', PermissionAction.CREATE)) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')

    const result = await c.var.services.arAp.settle({
      docId: body.docId,
      flowId: body.flowId,
      amountCents: body.settleAmountCents,
      settleDate: body.settleDate,
    })

    logAuditAction(
      c,
      'settle',
      'ar_ap_doc',
      body.docId,
      JSON.stringify({ settlement_id: result.id, amountCents: body.settleAmountCents })
    )
    return { id: result.id }
  }) as any
)

// 账单详情
const getStatementRoute = createRoute({
  method: 'get',
  path: '/ar/statement',
  summary: 'Get document statement',
  request: {
    query: docIdQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: statementResponseSchema,
          }),
        },
      },
      description: 'Document statement',
    },
  },
})

arApRoutes.openapi(getStatementRoute, async c => {
  if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
  const { docId } = c.req.valid('query')

  // 优化：并行查询文档和settlements
  const service = c.var.services.arAp

  const [doc, settlements] = await Promise.all([
    service.getById(docId),
    service.getSettlements(docId),
  ])

  if (!doc) {
      throw Errors.NOT_FOUND('Document')}

  const settled = settlements.reduce((sum, s) => sum + s.settleAmountCents, 0)
  const remaining = (doc?.amountCents ?? 0) - settled

  return jsonResponse(
    c,
    apiSuccess({
      doc: doc,
      settlements: settlements,
      settledCents: settled,
      remainingCents: remaining,
    })
  )
})

// 确认 AR/AP 单据
const confirmArApDocRoute = createRoute({
  method: 'post',
  path: '/ar/confirm',
  summary: 'Confirm AR/AP document',
  request: {
    body: {
      content: {
        'application/json': {
          schema: confirmArApDocSchema,
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
            data: z.object({
              ok: z.boolean(),
              flowId: z.string(),
              voucherNo: z.string(),
            }),
          }),
        },
      },
      description: 'Confirmation result',
    },
  },
})

arApRoutes.openapi(confirmArApDocRoute, async c => {
  if (!hasPermission(c, PermissionModule.FINANCE, 'ar', PermissionAction.CREATE)) {
      throw Errors.FORBIDDEN()
    }
  const body = c.req.valid('json')

  const result = await c.var.services.arAp.confirm({
    docId: body.docId,
    accountId: body.accountId,
    bizDate: body.bizDate,
    categoryId: body.categoryId,
    method: body.method,
    voucherUrl: body.voucherUrl,
    createdBy: c.get('employeeId'),
    memo: body.memo,
  })

  logAuditAction(
    c,
    'confirm',
    'ar_ap_doc',
    body.docId,
    JSON.stringify({
      flowId: result.flowId,
      voucherNo: result.voucherNo,
    })
  )

  return jsonResponse(
    c,
    apiSuccess({ ok: true, flowId: result.flowId, voucherNo: result.voucherNo })
  )
})

// AP 路由（复用 AR 的逻辑，但路径不同）
arApRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ap/docs',
    summary: 'List AP documents',
    request: {
      query: z
        .object({
          status: z.string().optional(),
        })
        .merge(paginationSchema),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                items: z.array(arApDocWithExtrasSchema),
                pagination: z.object({
                  page: z.number(),
                  pageSize: z.number(),
                  total: z.number(),
                  totalPages: z.number(),
                }),
              }),
            }),
          },
        },
        description: 'List of AP documents',
      },
    },
  }),
  createPaginatedHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { status } = c.req.valid('query')
    const { page, limit } = parsePagination(c)

    const accessFilter = getDataAccessFilterSQL(c, 'ar_ap_docs', { skipOrgDept: true })

    const conditions: any[] = [sql`ar_ap_docs.kind = 'AP'`]
    if (status) {
      conditions.push(sql`ar_ap_docs.status = ${status}`)
    }

    // 添加数据访问过滤条件
    conditions.push(accessFilter)

    let whereClause = sql``
    if (conditions.length > 0) {
      conditions.forEach((cond, i) => {
        if (i > 0) {
          whereClause = whereClause.append(sql` and `)
        }
        whereClause = whereClause.append(cond)
      })
    } else {
      whereClause = sql`1=1`
    }

    const { total, list } = await c.var.services.arAp.list(page, limit, whereClause)

    const items = list.map((row: any) => {
      const d = row.doc
      return {
        id: d.id,
        kind: d.kind,
        docNo: d.docNo,
        partyId: d.partyId,
        siteId: d.siteId,
        projectId: d.projectId,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        amountCents: d.amountCents,
        status: d.status,
        memo: d.memo,
        createdAt: d.createdAt,
        settledCents: row.settledCents,
        siteName: row.siteName,
      }
    })

    return { items, total }
  }) as any
)

arApRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ap/settlements',
    summary: 'List AP settlements',
    request: {
      query: docIdQuerySchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                results: z.array(settlementResponseSchema),
              }),
            }),
          },
        },
        description: 'List of settlements',
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { docId } = c.req.valid('query')

    const service = c.var.services.arAp
    const rows = await service.getSettlements(docId)
    return { results: rows }
  }) as any
)

arApRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/ap/statement',
    summary: 'Get AP document statement',
    request: {
      query: docIdQuerySchema,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: statementResponseSchema,
            }),
          },
        },
        description: 'Document statement',
      },
    },
  }),
  async c => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { docId } = c.req.valid('query')

    const service = c.var.services.arAp

    const [doc, settlements] = await Promise.all([
      service.getById(docId),
      service.getSettlements(docId),
    ])

    if (!doc) {
      throw Errors.NOT_FOUND('Document')}

    const settled = settlements.reduce((sum, s) => sum + s.settleAmountCents, 0)
    const remaining = (doc?.amountCents ?? 0) - settled

    return jsonResponse(
      c,
      apiSuccess({
        doc: doc,
        settlements: settlements,
        settledCents: settled,
        remainingCents: remaining,
      })
    )
  }
)
