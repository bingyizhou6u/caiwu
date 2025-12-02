import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, gte, lte } from 'drizzle-orm'
import { accountTransfers } from '../db/schema.js'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createAccountTransferSchema } from '../schemas/business.schema.js'
import { idParamSchema } from '../schemas/common.schema.js'

export const accountTransfersRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const accountTransferResponseSchema = z.object({
  id: z.string(),
  transfer_date: z.string(),
  from_account_id: z.string(),
  to_account_id: z.string(),
  from_currency: z.string(),
  to_currency: z.string(),
  from_amount_cents: z.number(),
  to_amount_cents: z.number(),
  exchange_rate: z.number().nullable(),
  memo: z.string().nullable(),
  voucher_url: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.number().nullable(),
  from_account_name: z.string().nullable(),
  from_account_currency: z.string().nullable(),
  to_account_name: z.string().nullable(),
  to_account_currency: z.string().nullable()
})

const listAccountTransfersResponseSchema = z.object({
  results: z.array(accountTransferResponseSchema)
})

// Routes

// List Account Transfers
accountTransfersRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/account-transfers',
    summary: 'List account transfers',
    request: {
      query: z.object({
        from_account_id: z.string().optional(),
        to_account_id: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        limit: z.coerce.number().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listAccountTransfersResponseSchema
          }
        },
        description: 'List of account transfers'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'transfer', 'view')) throw Errors.FORBIDDEN()

    const query = c.req.valid('query')
    const fromAccountId = query.from_account_id
    const toAccountId = query.to_account_id
    const startDate = query.start_date
    const endDate = query.end_date
    const limit = query.limit || 200

    const conditions = []
    if (fromAccountId) conditions.push(eq(accountTransfers.fromAccountId, fromAccountId))
    if (toAccountId) conditions.push(eq(accountTransfers.toAccountId, toAccountId))
    if (startDate) conditions.push(gte(accountTransfers.transferDate, startDate))
    if (endDate) conditions.push(lte(accountTransfers.transferDate, endDate))

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await c.var.services.finance.listAccountTransfers(limit, whereClause)

    const results = rows.map(row => {
      const t = row.transfer
      return {
        id: t.id,
        transfer_date: t.transferDate,
        from_account_id: t.fromAccountId,
        to_account_id: t.toAccountId,
        from_amount_cents: t.fromAmountCents,
        to_amount_cents: t.toAmountCents,
        exchange_rate: t.exchangeRate,
        memo: t.memo,
        voucher_url: t.voucherUrl,
        created_by: t.createdBy,
        created_at: t.createdAt,
        from_account_name: row.fromAccountName,
        from_account_currency: row.fromAccountCurrency,
        to_account_name: row.toAccountName,
        to_account_currency: row.toAccountCurrency
      }
    })

    return c.json({ results } as any)
  }
)

// Create Account Transfer
accountTransfersRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/account-transfers',
    summary: 'Create account transfer',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createAccountTransferSchema
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
        description: 'Created transfer ID'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'transfer', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    const result = await c.var.services.finance.createAccountTransfer({
      transferDate: body.transfer_date,
      fromAccountId: body.from_account_id,
      toAccountId: body.to_account_id,
      fromAmountCents: body.from_amount_cents,
      toAmountCents: body.to_amount_cents,
      exchangeRate: body.exchange_rate,
      memo: body.memo,
      voucherUrl: body.voucher_url,
      createdBy: c.var.userId
    })

    logAuditAction(c, 'create', 'account_transfer', result.id, JSON.stringify({
      from_account_id: body.from_account_id,
      to_account_id: body.to_account_id,
      from_amount_cents: body.from_amount_cents,
      to_amount_cents: body.to_amount_cents
    }))

    return c.json({ id: result.id })
  }
)

// Get Account Transfer Detail
accountTransfersRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/account-transfers/{id}',
    summary: 'Get account transfer detail',
    request: {
      params: idParamSchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: accountTransferResponseSchema
          }
        },
        description: 'Account transfer detail'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'transfer', 'view')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')

    const row = await c.var.services.finance.getAccountTransfer(id)
    if (!row) {
      throw Errors.NOT_FOUND()
    }

    // Map Drizzle result to response schema if needed
    // Drizzle returns object with keys from selection.
    // The query in service returns { transfer: ..., fromAccountName: ..., ... }
    // We need to flatten it.
    const result = {
      ...row.transfer,
      from_account_name: row.fromAccountName,
      from_account_currency: row.fromAccountCurrency,
      to_account_name: row.toAccountName,
      to_account_currency: row.toAccountCurrency
    }

    return c.json(result as any)
  }
)

