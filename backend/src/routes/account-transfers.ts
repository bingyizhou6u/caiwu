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
  transferDate: z.string(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountCents: z.number(),
  toAmountCents: z.number(),
  exchangeRate: z.number().nullable(),
  memo: z.string().nullable(),
  voucherUrl: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  fromAccountName: z.string().nullable(),
  fromAccountCurrency: z.string().nullable(),
  toAccountName: z.string().nullable(),
  toAccountCurrency: z.string().nullable()
})

const listAccountTransfersResponseSchema = z.object({
  results: z.array(accountTransferResponseSchema)
})

// Routes

// 获取转账列表
accountTransfersRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/account-transfers',
    summary: 'List account transfers',
    request: {
      query: z.object({
        fromAccountId: z.string().optional(),
        toAccountId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
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
    const fromAccountId = query.fromAccountId
    const toAccountId = query.toAccountId
    const startDate = query.startDate
    const endDate = query.endDate
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
        transferDate: t.transferDate,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        fromAmountCents: t.fromAmountCents,
        toAmountCents: t.toAmountCents,
        fromCurrency: row.fromAccountCurrency || 'CNY', // 回退或派生
        toCurrency: row.toAccountCurrency || 'CNY',       // 回退或派生
        exchangeRate: t.exchangeRate,
        memo: t.memo,
        voucherUrl: t.voucherUrl,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
        fromAccountName: row.fromAccountName,
        fromAccountCurrency: row.fromAccountCurrency,
        toAccountName: row.toAccountName,
        toAccountCurrency: row.toAccountCurrency
      }
    })

    return c.json({ results } as any)
  }
)

// 创建转账
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
      transferDate: body.transferDate,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      fromAmountCents: body.fromAmountCents,
      toAmountCents: body.toAmountCents,
      exchangeRate: body.exchangeRate,
      memo: body.memo,
      voucherUrls: body.voucherUrl ? [body.voucherUrl] : undefined,
      createdBy: c.var.userId
    })

    logAuditAction(c, 'create', 'account_transfer', result.id, JSON.stringify({
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      fromAmountCents: body.fromAmountCents,
      toAmountCents: body.toAmountCents
    }))

    return c.json({ id: result.id })
  }
)

// 获取转账详情
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

    // 将 Drizzle 结果映射到响应 schema
    // Drizzle 返回包含选择键的对象。
    // 服务中的查询返回 { transfer: ..., fromAccountName: ..., ... }
    // 我们需要将其扁平化。
    const result = {
      ...row.transfer,
      fromCurrency: row.fromAccountCurrency || 'CNY',
      toCurrency: row.toAccountCurrency || 'CNY',
      fromAccountName: row.fromAccountName,
      fromAccountCurrency: row.fromAccountCurrency,
      toAccountName: row.toAccountName,
      toAccountCurrency: row.toAccountCurrency
    }

    return c.json(result as any)
  }
)

