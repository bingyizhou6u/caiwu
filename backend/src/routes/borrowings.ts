import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, desc, sql } from 'drizzle-orm'
import { borrowings, repayments } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getDataAccessFilter, isTeamMember, getUserId } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createBorrowingSchema, createRepaymentSchema } from '../schemas/business.schema.js'
import { borrowingQuerySchema, repaymentQuerySchema, uuidSchema, paginationSchema } from '../schemas/common.schema.js'

export const borrowingsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

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
  account_currency: z.string().nullable()
})

const listBorrowingsResponseSchema = z.object({
  total: z.number(),
  results: z.array(borrowingResponseSchema)
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
  creator_name: z.string().nullable()
})

const listRepaymentsResponseSchema = z.object({
  results: z.array(repaymentResponseSchema)
})

const balanceResponseSchema = z.object({
  results: z.array(z.object({
    userId: z.string(),
    borrower_name: z.string().nullable(),
    borrower_email: z.string().nullable(),
    currency: z.string(),
    total_borrowed_cents: z.number(),
    total_repaid_cents: z.number(),
    balance_cents: z.number()
  }))
})

// Routes

// 获取借款列表
borrowingsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/borrowings',
    summary: 'List borrowings',
    request: {
      query: borrowingQuerySchema.merge(paginationSchema)
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listBorrowingsResponseSchema
          }
        },
        description: 'List of borrowings'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const query = c.req.valid('query')
    const userId = query.userId

    const conditions = []
    if (isTeamMember(c)) {
      const currentUserId = getUserId(c)
      if (currentUserId) {
        conditions.push(eq(borrowings.userId, currentUserId))
      } else {
        return c.json({ results: [] } as any)
      }
    } else if (userId) {
      conditions.push(eq(borrowings.userId, userId))
    }

    const whereClause = conditions.length ? and(...conditions) : undefined
    const { page = 1, pageSize = 20 } = query

    const { total, list } = await c.var.services.borrowing.listBorrowings(page, pageSize, whereClause)

    return c.json({
      total,
      results: list.map(row => ({
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
        account_currency: row.accountCurrency
      }))
    } as any)
  }
)

// 创建借款
borrowingsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/borrowings',
    summary: 'Create borrowing',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createBorrowingSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: borrowingResponseSchema
          }
        },
        description: 'Created borrowing'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'borrowing', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.borrowing.createBorrowing({
      userId: body.userId,
      accountId: body.accountId,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      borrowDate: body.borrowDate,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'borrowing', result.id, JSON.stringify({ userId: body.userId, accountId: body.accountId, amountCents: Math.round(body.amount * 100) }))

    const created = await c.var.services.borrowing.getBorrowingById(result.id)

    return c.json(created as any)
  }
)

// 获取还款列表
borrowingsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/repayments',
    summary: 'List repayments',
    request: {
      query: repaymentQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listRepaymentsResponseSchema
          }
        },
        description: 'List of repayments'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const query = c.req.valid('query')
    const borrowingId = query.borrowingId

    // TODO: 将复杂查询移至 FinanceService
    // Build where clause using Drizzle
    const conditions = []
    if (isTeamMember(c)) {
      const currentUserId = getUserId(c)
      if (currentUserId) {
        // Filter by borrowing's userId
        conditions.push(eq(borrowings.userId, currentUserId))
      } else {
        return c.json({ results: [] } as any)
      }
    } else if (borrowingId) {
      conditions.push(eq(repayments.borrowingId, borrowingId))
    }

    const whereClause = conditions.length ? and(...conditions) : undefined

    const results = await c.var.services.borrowing.listRepayments(200, whereClause)

    // Convert to response format
    return c.json({
      results: results.map(row => ({
        ...row.repayment,
        userId: row.userId,
        borrower_name: row.borrowerName,
        borrower_email: row.borrowerEmail,
        accountName: row.accountName,
        account_currency: row.accountCurrency,
        creator_name: row.creatorName
      }))
    } as any)
  }
)

// 创建还款
borrowingsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/repayments',
    summary: 'Create repayment',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createRepaymentSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: repaymentResponseSchema
          }
        },
        description: 'Created repayment'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'borrowing', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.borrowing.createRepayment({
      borrowingId: body.borrowingId,
      accountId: body.accountId,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      repayDate: body.repayDate,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'repayment', result.id, JSON.stringify({ borrowingId: body.borrowingId, accountId: body.accountId, amountCents: Math.round(body.amount * 100) }))

    const created = await c.var.services.borrowing.getRepaymentById(result.id)

    return c.json(created as any)
  }
)

// 借款余额
borrowingsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/borrowings/balance',
    summary: 'Get borrowing balance per user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: balanceResponseSchema
          }
        },
        description: 'Borrowing balances'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()

    // 使用 userId 计算每个用户的借款余额
    // Apply data permission
    const { where, binds: scopeBinds } = getDataAccessFilter(c, 'e')

    // Construct SQL object for filter
    let whereClause = undefined
    if (where !== '1=1') {
      // Safe hack to build templated SQL from dynamic strings + binds
      whereClause = sql(Object.assign([where], { raw: [where] }) as any, ...scopeBinds)
    }

    const rows = await c.var.services.borrowing.getBorrowingBalances(whereClause)

    return c.json({ results: rows } as any)
  }
)


