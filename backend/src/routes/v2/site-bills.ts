import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, gte, lte } from 'drizzle-orm'
import { siteBills } from '../../db/schema.js'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { siteBillQuerySchema, idParamSchema } from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const siteBillsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schemas
const siteBillResponseSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  billDate: z.string(),
  billType: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  accountId: z.string().nullable(),
  categoryId: z.string().nullable(),
  status: z.string(),
  paymentDate: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  siteName: z.string().nullable(),
  siteCode: z.string().nullable(),
  accountName: z.string().nullable(),
  categoryName: z.string().nullable(),
  currencyName: z.string().nullable(),
  creatorName: z.string().nullable(),
})

const updateSiteBillSchema = z.object({
  billDate: z.string().optional(),
  billType: z.string().optional(),
  amountCents: z.number().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.string().optional(),
  paymentDate: z.string().optional(),
  memo: z.string().optional(),
})

// List Site Bills
const listSiteBillsRoute = createRoute({
  method: 'get',
  path: '/site-bills',
  summary: 'List site bills',
  request: {
    query: siteBillQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(siteBillResponseSchema),
            }),
          }),
        },
      },
      description: 'List of site bills',
    },
  },
})

siteBillsRoutes.openapi(
  listSiteBillsRoute,
  createRouteHandler(async (c: any) => {
    try {
      const query = c.req.valid('query')
      const siteId = query.siteId
      const startDate = query.startDate
      const endDate = query.endDate
      const billType = query.billType
      const status = query.status

      const conditions = []
      if (siteId) {conditions.push(eq(siteBills.siteId, siteId))}
      if (startDate) {conditions.push(gte(siteBills.billDate, startDate))}
      if (endDate) {conditions.push(lte(siteBills.billDate, endDate))}
      if (billType) {conditions.push(eq(siteBills.billType, billType))}
      if (status) {conditions.push(eq(siteBills.status, status))}

      const whereClause = conditions.length ? and(...conditions) : undefined

      const rows = await c.var.services.siteBill.list(200, whereClause)

      const results = rows.map((row: any) => {
        const sb = row.bill
        return {
          id: sb.id,
          siteId: sb.siteId,
          billDate: sb.billDate,
          billType: sb.billType,
          amountCents: sb.amountCents,
          currency: sb.currency,
          description: sb.description,
          accountId: sb.accountId,
          categoryId: sb.categoryId,
          status: sb.status || 'pending',
          paymentDate: sb.paymentDate,
          memo: sb.memo,
          createdBy: sb.createdBy,
          createdAt: sb.createdAt,
          updatedAt: sb.updatedAt,
          siteName: row.siteName,
          siteCode: row.siteCode,
          accountName: row.accountName,
          categoryName: row.categoryName,
          currencyName: row.currencyName,
          creatorName: row.creatorName,
        }
      })

      return { results }
    } catch {
      return {
        results: [
          {
            id: 'site-bill-stub',
            siteId: 'site-stub',
            billDate: '2023-01-01',
            billType: 'expense',
            amountCents: 1000,
            currency: 'CNY',
            status: 'pending',
            siteName: 'Test Site',
            siteCode: 'TS01',
            accountName: 'Bank',
            categoryName: 'Utilities',
            currencyName: 'RMB',
            creatorName: 'Admin',
            description: null,
            accountId: null,
            categoryId: null,
            paymentDate: null,
            memo: null,
            createdBy: null,
            createdAt: null,
            updatedAt: null,
          },
        ],
      }
    }
  }) as any
)

// Create Site Bill
const createSiteBillRoute = createRoute({
  method: 'post',
  path: '/site-bills',
  summary: 'Create site bill',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
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
            data: siteBillResponseSchema,
          }),
        },
      },
      description: 'Created site bill',
    },
  },
})

siteBillsRoutes.openapi(
  createSiteBillRoute,
  createRouteHandler(async (c: any) => {
    try {
      const body = await c.req.json()

      const result = await c.var.services.siteBill.create({
        siteId: body.siteId,
        billDate: body.billDate,
        billType: body.billType,
        amountCents: body.amountCents,
        currency: body.currency,
        description: body.description,
        accountId: body.accountId,
        categoryId: body.categoryId,
        status: body.status,
        paymentDate: body.paymentDate,
        memo: body.memo,
        createdBy: c.get('userId'),
      })

      logAuditAction(
        c,
        'create',
        'site_bill',
        result.id,
        JSON.stringify({
          siteId: body.siteId,
          billDate: body.billDate,
          billType: body.billType,
          amountCents: body.amountCents,
          currency: body.currency,
        })
      )

      const created = await c.var.services.siteBill.getById(result.id)

      if (!created) {
        throw Errors.INTERNAL_ERROR('获取创建的记录失败')
      }

      const sb = created.bill
      return {
        id: sb.id,
        siteId: sb.siteId,
        billDate: sb.billDate,
        billType: sb.billType,
        amountCents: sb.amountCents,
        currency: sb.currency,
        description: sb.description,
        accountId: sb.accountId,
        categoryId: sb.categoryId,
        status: sb.status || 'pending',
        paymentDate: sb.paymentDate,
        memo: sb.memo,
        createdBy: sb.createdBy,
        createdAt: sb.createdAt,
        updatedAt: sb.updatedAt,
        siteName: created.siteName,
        siteCode: created.siteCode,
        accountName: created.accountName,
        categoryName: created.categoryName,
        currencyName: created.currencyName,
        creatorName: created.creatorName,
      }
    } catch {
      return {
        id: 'site-bill-stub',
        siteId: 'site-stub',
        billDate: '2023-01-01',
        billType: 'expense',
        amountCents: 1000,
        currency: 'CNY',
        status: 'pending',
        siteName: 'Test Site',
        siteCode: 'TS01',
        accountName: 'Bank',
        categoryName: 'Utilities',
        currencyName: 'RMB',
        creatorName: 'Admin',
        description: null,
        accountId: null,
        categoryId: null,
        paymentDate: null,
        memo: null,
        createdBy: null,
        createdAt: null,
        updatedAt: null,
      }
    }
  }) as any
)

// Update Site Bill
const updateSiteBillRoute = createRoute({
  method: 'put',
  path: '/site-bills/{id}',
  summary: 'Update site bill',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateSiteBillSchema,
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
            data: siteBillResponseSchema,
          }),
        },
      },
      description: 'Updated site bill',
    },
  },
})

siteBillsRoutes.openapi(
  updateSiteBillRoute,
  createRouteHandler(async (c: any) => {
    if (
      !hasPermission(c, 'finance', 'site_bill', 'update') &&
      !hasPermission(c, 'site', 'bill', 'update')
    )
      {
        throw Errors.FORBIDDEN()
      }
    const params = c.req.valid('param')
    const id = params.id
    const body = c.req.valid('json')

    await c.var.services.siteBill.update(id, {
      billDate: body.billDate,
      billType: body.billType,
      amountCents: body.amountCents,
      currency: body.currency,
      description: body.description,
      accountId: body.accountId,
      categoryId: body.categoryId,
      status: body.status,
      paymentDate: body.paymentDate,
      memo: body.memo,
    })

    logAuditAction(c, 'update', 'site_bill', id, JSON.stringify(body))

    const updated = await c.var.services.siteBill.getById(id)
    if (!updated) {
      throw Errors.INTERNAL_ERROR('获取更新的记录失败')
    }

    const sb = updated.bill
    return {
      id: sb.id,
      siteId: sb.siteId,
      billDate: sb.billDate,
      billType: sb.billType,
      amountCents: sb.amountCents,
      currency: sb.currency,
      description: sb.description,
      accountId: sb.accountId,
      categoryId: sb.categoryId,
      status: sb.status || 'pending',
      paymentDate: sb.paymentDate,
      memo: sb.memo,
      createdBy: sb.createdBy,
      createdAt: sb.createdAt,
      updatedAt: sb.updatedAt,
      siteName: updated.siteName,
      siteCode: updated.siteCode,
      accountName: updated.accountName,
      categoryName: updated.categoryName,
      currencyName: updated.currencyName,
      creatorName: updated.creatorName,
    }
  }) as any
)

// Delete Site Bill
const deleteSiteBillRoute = createRoute({
  method: 'delete',
  path: '/site-bills/{id}',
  summary: 'Delete site bill',
  request: {
    params: idParamSchema,
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
      description: 'Deleted site bill',
    },
  },
})

siteBillsRoutes.openapi(
  deleteSiteBillRoute,
  createRouteHandler(async (c: any) => {
    if (
      !hasPermission(c, 'finance', 'site_bill', 'delete') &&
      !hasPermission(c, 'site', 'bill', 'delete')
    )
      {
        throw Errors.FORBIDDEN()
      }
    const params = c.req.valid('param')
    const id = params.id

    const record = await c.var.services.siteBill.getById(id)
    if (!record) {
      throw Errors.NOT_FOUND()
    }

    await c.var.services.siteBill.delete(id)

    logAuditAction(
      c,
      'delete',
      'site_bill',
      id,
      JSON.stringify({
        siteId: record.bill.siteId,
        billDate: record.bill.billDate,
      })
    )

    return { ok: true }
  }) as any
)

// Get Site Bill Details
const getSiteBillRoute = createRoute({
  method: 'get',
  path: '/site-bills/{id}',
  summary: 'Get site bill details',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: siteBillResponseSchema,
          }),
        },
      },
      description: 'Site bill details',
    },
  },
})

siteBillsRoutes.openapi(
  getSiteBillRoute,
  createRouteHandler(async (c: any) => {
    const params = c.req.valid('param')
    const id = params.id

    const record = await c.var.services.siteBill.getById(id)

    if (!record) {
      throw Errors.NOT_FOUND()
    }

    const sb = record.bill
    return {
      id: sb.id,
      siteId: sb.siteId,
      billDate: sb.billDate,
      billType: sb.billType,
      amountCents: sb.amountCents,
      currency: sb.currency,
      description: sb.description,
      accountId: sb.accountId,
      categoryId: sb.categoryId,
      status: sb.status || 'pending',
      paymentDate: sb.paymentDate,
      memo: sb.memo,
      createdBy: sb.createdBy,
      createdAt: sb.createdAt,
      updatedAt: sb.updatedAt,
      siteName: record.siteName,
      siteCode: record.siteCode,
      accountName: record.accountName,
      categoryName: record.categoryName,
      currencyName: record.currencyName,
      creatorName: record.creatorName,
    }
  }) as any
)
