import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, sql } from 'drizzle-orm'
import { borrowings, repayments } from '../../db/schema.js'
import type { Env, AppVariables } from '../../types.js'
import {
  hasPermission,
  getUserPosition,
  getDataAccessFilter,
  isTeamMember,
  getUserId,
} from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createBorrowingSchema, createRepaymentSchema } from '../../schemas/business.schema.js'
import {
  borrowingQuerySchema,
  repaymentQuerySchema,
  paginationSchema,
} from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler, createPaginatedHandler, parsePagination } from '../../utils/route-helpers.js'

export const borrowingsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const borrowingResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  borrower_id: z.string().nullable(),
  accountId: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  borrowDate: z.string(),
  memo: z.string().nullable(),
  createdAt: z.number().nullable(),
  borrower_name: z.string().nullable(),
  borrower_email: z.string().nullable(),
  accountName: z.string().nullable(),
  account_currency: z.string().nullable(),
})

const repaymentResponseSchema = z.object({
  id: z.string(),
  borrowingId: z.string(),
  accountId: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  repayDate: z.string(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  userId: z.string().nullable(),
  borrower_name: z.string().nullable(),
  borrower_email: z.string().nullable(),
  accountName: z.string().nullable(),
  account_currency: z.string().nullable(),
  creator_name: z.string().nullable(),
})

const balanceItemSchema = z.object({
  userId: z.string(),
  borrower_name: z.string().nullable(),
  borrower_email: z.string().nullable(),
  currency: z.string(),
  total_borrowed_cents: z.number(),
  total_repaid_cents: z.number(),
  balance_cents: z.number(),
})

// 获取借款列表
const listBorrowingsRoute = createRoute({
  method: 'get',
  path: '/borrowings',
  summary: 'List borrowings',
  request: {
    query: borrowingQuerySchema.merge(paginationSchema),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              items: z.array(borrowingResponseSchema),
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
      description: 'List of borrowings',
    },
  },
})

borrowingsRoutes.openapi(
  listBorrowingsRoute,
  createPaginatedHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const query = c.req.valid('query')
    const userId = query.userId
    const { page, limit } = parsePagination(c)

    const conditions = []
    if (isTeamMember(c)) {
      const currentUserId = getUserId(c)
      if (currentUserId) {
        conditions.push(eq(borrowings.userId, currentUserId))
      } else {
        return { items: [], total: 0 }
      }
    } else if (userId) {
      conditions.push(eq(borrowings.userId, userId))
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const { total, list } = await c.var.services.borrowing.listBorrowings(page, limit, whereClause)

    const items = list.map((row: any) => ({
      id: row.borrowing.id,
      userId: row.borrowing.userId,
      borrower_id: row.borrowing.userId,
      accountId: row.borrowing.accountId,
      amountCents: row.borrowing.amountCents,
      currency: row.borrowing.currency,
      borrowDate: row.borrowing.borrowDate,
      memo: row.borrowing.memo,
      createdAt: row.borrowing.createdAt,
      borrower_name: row.borrowerName,
      borrower_email: row.borrowerEmail,
      accountName: row.accountName,
      account_currency: row.accountCurrency,
    }))

    return { items, total }
  }) as any
)

// 创建借款
const createBorrowingRoute = createRoute({
  method: 'post',
  path: '/borrowings',
  summary: 'Create borrowing',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBorrowingSchema,
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
            data: borrowingResponseSchema,
          }),
        },
      },
      description: 'Created borrowing',
    },
  },
})

borrowingsRoutes.openapi(
  createBorrowingRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'finance', 'borrowing', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')

    const result = await c.var.services.borrowing.createBorrowing({
      userId: body.userId,
      accountId: body.accountId,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      borrowDate: body.borrowDate,
      memo: body.memo,
      createdBy: c.get('userId'),
    })

    logAuditAction(
      c,
      'create',
      'borrowing',
      result.id,
      JSON.stringify({
        userId: body.userId,
        accountId: body.accountId,
        amountCents: Math.round(body.amount * 100),
      })
    )

    const created = await c.var.services.borrowing.getBorrowingById(result.id)
    return created
  }) as any
)

// 获取还款列表
const listRepaymentsRoute = createRoute({
  method: 'get',
  path: '/repayments',
  summary: 'List repayments',
  request: {
    query: repaymentQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(repaymentResponseSchema),
            }),
          }),
        },
      },
      description: 'List of repayments',
    },
  },
})

borrowingsRoutes.openapi(
  listRepaymentsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const query = c.req.valid('query')
    const borrowingId = query.borrowingId

    const conditions = []
    if (isTeamMember(c)) {
      const currentUserId = getUserId(c)
      if (currentUserId) {
        conditions.push(eq(borrowings.userId, currentUserId))
      } else {
        return { results: [] }
      }
    } else if (borrowingId) {
      conditions.push(eq(repayments.borrowingId, borrowingId))
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const results = await c.var.services.borrowing.listRepayments(200, whereClause)

    return {
      results: results.map((row: any) => ({
        ...row.repayment,
        userId: row.userId,
        borrower_name: row.borrowerName,
        borrower_email: row.borrowerEmail,
        accountName: row.accountName,
        account_currency: row.accountCurrency,
        creator_name: row.creatorName,
      })),
    }
  }) as any
)

// 创建还款
const createRepaymentRoute = createRoute({
  method: 'post',
  path: '/repayments',
  summary: 'Create repayment',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createRepaymentSchema,
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
            data: repaymentResponseSchema,
          }),
        },
      },
      description: 'Created repayment',
    },
  },
})

borrowingsRoutes.openapi(
  createRepaymentRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'finance', 'borrowing', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')

    const result = await c.var.services.borrowing.createRepayment({
      borrowingId: body.borrowingId,
      accountId: body.accountId,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      repayDate: body.repayDate,
      memo: body.memo,
      createdBy: c.get('userId'),
    })

    logAuditAction(
      c,
      'create',
      'repayment',
      result.id,
      JSON.stringify({
        borrowingId: body.borrowingId,
        accountId: body.accountId,
        amountCents: Math.round(body.amount * 100),
      })
    )

    const created = await c.var.services.borrowing.getRepaymentById(result.id)
    return created
  }) as any
)

// 借款余额
const getBorrowingBalanceRoute = createRoute({
  method: 'get',
  path: '/borrowings/balance',
  summary: 'Get borrowing balance per user',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(balanceItemSchema),
            }),
          }),
        },
      },
      description: 'Borrowing balances',
    },
  },
})

borrowingsRoutes.openapi(
  getBorrowingBalanceRoute,
  createRouteHandler(async c => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }

    const { where, binds: scopeBinds } = getDataAccessFilter(c, 'e')

    let whereClause = undefined
    if (where !== '1=1') {
      whereClause = sql(Object.assign([where], { raw: [where] }) as any, ...scopeBinds)
    }

    const rows = await c.var.services.borrowing.getBorrowingBalances(whereClause)
    return { results: rows }
  }) as any
)
