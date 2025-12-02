import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, gte, lte } from 'drizzle-orm'
import { siteBills } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getDataAccessFilter } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createSiteBillSchema, updateSiteBillSchema } from '../schemas/business.schema.js'
import { siteBillQuerySchema, idParamSchema } from '../schemas/common.schema.js'

export const siteBillsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const siteBillResponseSchema = z.object({
  id: z.string(),
  site_id: z.string(),
  bill_date: z.string(),
  bill_type: z.string(),
  amount_cents: z.number(),
  currency: z.string(),
  description: z.string().nullable(),
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  status: z.string(),
  payment_date: z.string().nullable(),
  memo: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable(),
  site_name: z.string().nullable(),
  site_code: z.string().nullable(),
  account_name: z.string().nullable(),
  category_name: z.string().nullable(),
  currency_name: z.string().nullable(),
  creator_name: z.string().nullable()
})

const listSiteBillsResponseSchema = z.object({
  results: z.array(siteBillResponseSchema)
})

// Routes

// List Site Bills
siteBillsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/site-bills',
    summary: 'List site bills',
    request: {
      query: siteBillQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listSiteBillsResponseSchema
          }
        },
        description: 'List of site bills'
      }
    }
  }),
  async (c) => {
    // 所有人都可以查看（通过数据权限过滤）
    const query = c.req.valid('query')
    const siteId = query.site_id
    const startDate = query.start_date
    const endDate = query.end_date
    const billType = query.bill_type
    const status = query.status

    const conditions = []
    if (siteId) conditions.push(eq(siteBills.siteId, siteId))
    if (startDate) conditions.push(gte(siteBills.billDate, startDate))
    if (endDate) conditions.push(lte(siteBills.billDate, endDate))
    if (billType) conditions.push(eq(siteBills.billType, billType))
    if (status) conditions.push(eq(siteBills.status, status))

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await c.var.services.finance.listSiteBills(200, whereClause)

    const results = rows.map(row => {
      const sb = row.bill
      return {
        id: sb.id,
        site_id: sb.siteId,
        bill_date: sb.billDate,
        bill_type: sb.billType,
        amount_cents: sb.amountCents,
        currency: sb.currency,
        description: sb.description,
        account_id: sb.accountId,
        category_id: sb.categoryId,
        status: sb.status,
        payment_date: sb.paymentDate,
        memo: sb.memo,
        created_by: sb.createdBy,
        created_at: sb.createdAt,
        updated_at: sb.updatedAt,
        site_name: row.siteName,
        site_code: row.siteCode,
        account_name: row.accountName,
        category_name: row.categoryName,
        currency_name: row.currencyName,
        creator_name: row.creatorName
      }
    })

    return c.json({ results } as any)
  }
)

// Create Site Bill
siteBillsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/site-bills',
    summary: 'Create site bill',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createSiteBillSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: siteBillResponseSchema
          }
        },
        description: 'Created site bill'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'site_bill', 'create') && !hasPermission(c, 'site', 'bill', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.finance.createSiteBill({
      siteId: body.site_id,
      billDate: body.bill_date,
      billType: body.bill_type,
      amountCents: body.amount_cents,
      currency: body.currency,
      description: body.description,
      accountId: body.account_id,
      categoryId: body.category_id,
      status: body.status,
      paymentDate: body.payment_date,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'site_bill', result.id, JSON.stringify({
      site_id: body.site_id,
      bill_date: body.bill_date,
      bill_type: body.bill_type,
      amount_cents: body.amount_cents,
      currency: body.currency
    }))

    const created = await c.env.DB.prepare(`
      select 
        sb.*,
        s.name as site_name,
        s.site_code,
        a.name as account_name,
        c.name as category_name,
        cur.name as currency_name,
        ce.name as creator_name
      from site_bills sb
      left join sites s on s.id = sb.site_id
      left join accounts a on a.id = sb.account_id
      left join categories c on c.id = sb.category_id
      left join currencies cur on cur.code = sb.currency
      left join users u on u.id = sb.created_by
      left join employees ce on ce.email = u.email
      where sb.id=?
    `).bind(result.id).first()

    return c.json(created as any)
  }
)

// Update Site Bill
siteBillsRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/site-bills/{id}',
    summary: 'Update site bill',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateSiteBillSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: siteBillResponseSchema
          }
        },
        description: 'Updated site bill'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'site_bill', 'update') && !hasPermission(c, 'site', 'bill', 'update')) throw Errors.FORBIDDEN()
    const params = c.req.valid('param')
    const id = params.id
    const body = c.req.valid('json')

    await c.var.services.finance.updateSiteBill(id, {
      billDate: body.bill_date,
      billType: body.bill_type,
      amountCents: body.amount_cents,
      currency: body.currency,
      description: body.description,
      accountId: body.account_id,
      categoryId: body.category_id,
      status: body.status,
      paymentDate: body.payment_date,
      memo: body.memo
    })

    logAuditAction(c, 'update', 'site_bill', id, JSON.stringify(body))

    const updated = await c.env.DB.prepare(`
      select 
        sb.*,
        s.name as site_name,
        s.site_code,
        a.name as account_name,
        c.name as category_name,
        cur.name as currency_name,
        ce.name as creator_name
      from site_bills sb
      left join sites s on s.id = sb.site_id
      left join accounts a on a.id = sb.account_id
      left join categories c on c.id = sb.category_id
      left join currencies cur on cur.code = sb.currency
      left join users u on u.id = sb.created_by
      left join employees ce on ce.email = u.email
      where sb.id=?
    `).bind(id).first()

    return c.json(updated as any)
  }
)

// Delete Site Bill
siteBillsRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/site-bills/{id}',
    summary: 'Delete site bill',
    request: {
      params: idParamSchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        },
        description: 'Deleted site bill'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'site_bill', 'delete') && !hasPermission(c, 'site', 'bill', 'delete')) throw Errors.FORBIDDEN()
    const params = c.req.valid('param')
    const id = params.id

    const record = await c.env.DB.prepare('select * from site_bills where id=?').bind(id).first<any>()
    if (!record) throw Errors.NOT_FOUND()

    await c.var.services.finance.deleteSiteBill(id)

    logAuditAction(c, 'delete', 'site_bill', id, JSON.stringify({
      site_id: record.site_id,
      bill_date: record.bill_date
    }))

    return c.json({ ok: true })
  }
)

// Get Site Bill Details
siteBillsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/site-bills/{id}',
    summary: 'Get site bill details',
    request: {
      params: idParamSchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: siteBillResponseSchema
          }
        },
        description: 'Site bill details'
      }
    }
  }),
  async (c) => {
    // 所有人都可以查看
    const params = c.req.valid('param')
    const id = params.id

    // TODO: Move to FinanceService
    const record = await c.env.DB.prepare(`
      select 
        sb.*,
        s.name as site_name,
        s.site_code,
        a.name as account_name,
        c.name as category_name,
        cur.name as currency_name,
        ce.name as creator_name
      from site_bills sb
      left join sites s on s.id = sb.site_id
      left join accounts a on a.id = sb.account_id
      left join categories c on c.id = sb.category_id
      left join currencies cur on cur.code = sb.currency
      left join users u on u.id = sb.created_by
      left join employees ce on ce.email = u.email
      where sb.id=?
    `).bind(id).first()

    if (!record) throw Errors.NOT_FOUND()

    return c.json(record as any)
  }
)
