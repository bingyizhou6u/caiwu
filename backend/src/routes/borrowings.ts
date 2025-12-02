import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, desc } from 'drizzle-orm'
import { borrowings } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getDataAccessFilter, isTeamMember, getUserId } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createBorrowingSchema, createRepaymentSchema } from '../schemas/business.schema.js'
import { borrowingQuerySchema, repaymentQuerySchema, uuidSchema } from '../schemas/common.schema.js'

export const borrowingsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const borrowingResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  borrower_id: z.string().nullable(),
  account_id: z.string(),
  amount_cents: z.number(),
  currency: z.string(),
  borrow_date: z.string(),
  memo: z.string().nullable(),
  created_at: z.number().nullable(),
  borrower_name: z.string().nullable(),
  borrower_email: z.string().nullable(),
  account_name: z.string().nullable(),
  account_currency: z.string().nullable()
})

const listBorrowingsResponseSchema = z.object({
  results: z.array(borrowingResponseSchema)
})

const repaymentResponseSchema = z.object({
  id: z.string(),
  borrowing_id: z.string(),
  account_id: z.string(),
  amount_cents: z.number(),
  currency: z.string(),
  repay_date: z.string(),
  memo: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.number().nullable(),
  user_id: z.string().nullable(),
  borrower_name: z.string().nullable(),
  borrower_email: z.string().nullable(),
  account_name: z.string().nullable(),
  account_currency: z.string().nullable(),
  creator_name: z.string().nullable()
})

const listRepaymentsResponseSchema = z.object({
  results: z.array(repaymentResponseSchema)
})

const balanceResponseSchema = z.object({
  results: z.array(z.object({
    user_id: z.string(),
    borrower_name: z.string().nullable(),
    borrower_email: z.string().nullable(),
    currency: z.string(),
    total_borrowed_cents: z.number(),
    total_repaid_cents: z.number(),
    balance_cents: z.number()
  }))
})

// Routes

// List Borrowings
borrowingsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/borrowings',
    summary: 'List borrowings',
    request: {
      query: borrowingQuerySchema
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
    const userId = query.user_id

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

    const rows = await c.var.services.finance.listBorrowings(200, whereClause)

    const results = rows.map(row => {
      const b = row.borrowing
      return {
        id: b.id,
        user_id: b.userId,
        borrower_id: b.userId, // Assuming borrower_id is same as user_id
        account_id: b.accountId,
        amount_cents: b.amountCents,
        currency: b.currency,
        borrow_date: b.borrowDate,
        memo: b.memo,
        created_at: b.createdAt,
        borrower_name: row.borrowerName,
        borrower_email: row.borrowerEmail,
        account_name: row.accountName,
        account_currency: row.accountCurrency
      }
    })

    return c.json({ results } as any)
  }
)

// Create Borrowing
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

    const result = await c.var.services.finance.createBorrowing({
      userId: body.user_id,
      accountId: body.account_id,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      borrowDate: body.borrow_date,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'borrowing', result.id, JSON.stringify({ user_id: body.user_id, account_id: body.account_id, amount_cents: Math.round(body.amount * 100) }))

    // Fetch full details to return
    const created = await c.env.DB.prepare(`
      select b.*, 
        e.name as borrower_name, u.email as borrower_email,
        a.name as account_name, a.currency as account_currency
      from borrowings b
      left join users u on u.id=b.user_id
      left join employees e on e.email=u.email
      left join accounts a on a.id=b.account_id
      where b.id=?
    `).bind(result.id).first()

    return c.json(created as any)
  }
)

// List Repayments
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
    const borrowingId = query.borrowing_id

    // TODO: Move complex query to FinanceService
    let sql = `
      select r.*, b.user_id, e.name as borrower_name, u.email as borrower_email,
        a.name as account_name, a.currency as account_currency,
        ce.name as creator_name
      from repayments r
      left join borrowings b on b.id=r.borrowing_id
      left join users u on u.id=b.user_id
      left join employees e on e.email=u.email
      left join accounts a on a.id=r.account_id
      left join users creator on creator.id=r.created_by
      left join employees ce on ce.email=creator.email
    `
    const binds: any[] = []

    // 组员只能查看自己的还款记录（通过borrowing关联）
    if (isTeamMember(c)) {
      const currentUserId = getUserId(c)
      if (currentUserId) {
        sql += ' where b.user_id = ?'
        binds.push(currentUserId)
      } else {
        return c.json({ results: [] } as any)
      }
    } else if (borrowingId) {
      sql += ' where r.borrowing_id=?'
      binds.push(borrowingId)
    }

    sql += ' order by r.repay_date desc, r.created_at desc'

    const rows = await c.env.DB.prepare(sql).bind(...binds).all()
    return c.json({ results: rows.results ?? [] } as any)
  }
)

// Create Repayment
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

    const result = await c.var.services.finance.createRepayment({
      borrowingId: body.borrowing_id,
      accountId: body.account_id,
      amountCents: Math.round(body.amount * 100),
      currency: body.currency,
      repayDate: body.repay_date,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'repayment', result.id, JSON.stringify({ borrowing_id: body.borrowing_id, account_id: body.account_id, amount_cents: Math.round(body.amount * 100) }))

    const created = await c.env.DB.prepare(`
      select r.*, b.user_id, e.name as borrower_name, u.email as borrower_email,
        a.name as account_name, a.currency as account_currency,
        ce.name as creator_name
      from repayments r
      left join borrowings b on b.id=r.borrowing_id
      left join users u on u.id=b.user_id
      left join employees e on e.email=u.email
      left join accounts a on a.id=r.account_id
      left join users creator on creator.id=r.created_by
      left join employees ce on ce.email=creator.email
      where r.id=?
    `).bind(result.id).first()

    return c.json(created as any)
  }
)

// Borrowing Balance
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

    // 使用 user_id 计算每个用户的借款余额
    let sql = `
      select 
        u.id as user_id, 
        e.name as borrower_name, 
        u.email as borrower_email,
        b.currency,
        coalesce(sum(b.amount_cents), 0) as total_borrowed_cents,
        coalesce((
          select sum(r.amount_cents)
          from repayments r
          where r.borrowing_id in (
            select id from borrowings b2 
            where b2.user_id = b.user_id and b2.currency = b.currency
          )
        ), 0) as total_repaid_cents,
        (coalesce(sum(b.amount_cents), 0) - coalesce((
          select sum(r.amount_cents)
          from repayments r
          where r.borrowing_id in (
            select id from borrowings b2 
            where b2.user_id = b.user_id and b2.currency = b.currency
          )
        ), 0)) as balance_cents
      from users u
      inner join employees e on e.email = u.email
      inner join borrowings b on b.user_id = u.id
      where u.active = 1
      group by u.id, e.name, u.email, b.currency
      having balance_cents != 0
      order by e.name, b.currency
    `

    // 应用数据权限过滤
    const { where, binds: scopeBinds } = getDataAccessFilter(c, 'u')
    if (where !== '1=1') {
      // SQL 中已有 where 子句，使用 AND 追加条件
      const finalSql = sql.replace('where u.active = 1', `where u.active = 1 and ${where}`)
      const rows = await c.env.DB.prepare(finalSql).bind(...scopeBinds).all()
      return c.json({ results: rows.results ?? [] } as any)
    }
    const rows = await c.env.DB.prepare(sql).all()
    return c.json({ results: rows.results ?? [] } as any)
  }
)


// IP 白名单管理 - 列表

// Update Borrowing Status (Approve/Reject)
borrowingsRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/borrowings/{id}/status',
    summary: 'Update borrowing status',
    request: {
      params: z.object({ id: uuidSchema }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              status: z.enum(['approved', 'rejected']),
              memo: z.string().optional()
            })
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Updated status',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        }
      }
    }
  }),
  async (c) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json')
    const userId = getUserId(c) || 'system'
    const service = c.get('services').approval

    // Permission check is handled in service or here?
    // Service checks if user is subordinate.
    // We should also check if user has finance approval permission generally?
    // ApprovalService.approveBorrowing doesn't seem to check generic permission, only subordinate check?
    // Wait, ApprovalService checks: if (!subordinateIds.includes(leave.employeeId)) throw Errors.FORBIDDEN('无权审批');
    // But for borrowing, it just checks status.
    // Let's look at ApprovalService.approveBorrowing again.
    // It does NOT check subordinate for borrowing!
    // So we must check permission here.

    if (!hasPermission(c, 'finance', 'borrowing', 'approve')) {
      throw Errors.FORBIDDEN('没有审批借支的权限')
    }

    if (body.status === 'approved') {
      await service.approveBorrowing(id, userId, body.memo)
      logAuditAction(c, 'approve', 'borrowing', id, JSON.stringify({ action: 'approve' }))
    } else {
      await service.rejectBorrowing(id, userId, body.memo)
      logAuditAction(c, 'reject', 'borrowing', id, JSON.stringify({ action: 'reject', memo: body.memo }))
    }

    return c.json({ ok: true })
  }
)
