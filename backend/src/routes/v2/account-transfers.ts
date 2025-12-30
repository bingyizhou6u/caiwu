import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, eq, gte, lte } from 'drizzle-orm'
import { accountTransfers } from '../../db/schema.js'
import type { Env, AppVariables } from '../../types/index.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createAccountTransferSchema } from '../../schemas/business.schema.js'
import { idParamSchema } from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const accountTransfersRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：检查转账权限并返回 PermissionContext
 * 如果没有权限则抛出 FORBIDDEN 错误
 */
function requireTransferPermission(c: any, action: string): ReturnType<typeof createPermissionContext> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission('finance', 'transfer', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

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
  toAccountCurrency: z.string().nullable(),
})

// 获取转账列表
const listAccountTransfersRoute = createRoute({
  method: 'get',
  path: '/account-transfers',
  summary: 'List account transfers',
  request: {
    query: z.object({
      fromAccountId: z.string().optional(),
      toAccountId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(accountTransferResponseSchema),
            }),
          }),
        },
      },
      description: 'List of account transfers',
    },
  },
})

accountTransfersRoutes.openapi(
  listAccountTransfersRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireTransferPermission(c, 'view')

    const query = c.req.valid('query')
    const fromAccountId = query.fromAccountId
    const toAccountId = query.toAccountId
    const startDate = query.startDate
    const endDate = query.endDate
    const limit = query.limit || 200

    const conditions = []
    if (fromAccountId) {conditions.push(eq(accountTransfers.fromAccountId, fromAccountId))}
    if (toAccountId) {conditions.push(eq(accountTransfers.toAccountId, toAccountId))}
    if (startDate) {conditions.push(gte(accountTransfers.transferDate, startDate))}
    if (endDate) {conditions.push(lte(accountTransfers.transferDate, endDate))}

    const whereClause = conditions.length ? and(...conditions) : undefined

    const rows = await c.var.services.accountTransfer.list(limit, whereClause)

    const results = rows.map((row: any) => {
      const t = row.transfer
      return {
        id: t.id,
        transferDate: t.transferDate,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        fromAmountCents: t.fromAmountCents,
        toAmountCents: t.toAmountCents,
        fromCurrency: row.fromAccountCurrency || 'CNY',
        toCurrency: row.toAccountCurrency || 'CNY',
        exchangeRate: t.exchangeRate,
        memo: t.memo,
        voucherUrl: t.voucherUrl,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
        fromAccountName: row.fromAccountName,
        fromAccountCurrency: row.fromAccountCurrency,
        toAccountName: row.toAccountName,
        toAccountCurrency: row.toAccountCurrency,
      }
    })

    return { results }
  }) as any
)

// 创建转账
const createAccountTransferRoute = createRoute({
  method: 'post',
  path: '/account-transfers',
  summary: 'Create account transfer',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createAccountTransferSchema,
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
      description: 'Created transfer ID',
    },
  },
})

accountTransfersRoutes.openapi(
  createAccountTransferRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireTransferPermission(c, 'create')

    const body = c.req.valid('json')

    const result = await c.var.services.accountTransfer.create({
      transferDate: body.transferDate,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      fromAmountCents: body.fromAmountCents,
      toAmountCents: body.toAmountCents,
      exchangeRate: body.exchangeRate,
      memo: body.memo,
      voucherUrls: body.voucherUrl ? [body.voucherUrl] : undefined,
      createdBy: c.var.userId,
    })

    logAuditAction(
      c,
      'create',
      'account_transfer',
      result.id,
      JSON.stringify({
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        fromAmountCents: body.fromAmountCents,
        toAmountCents: body.toAmountCents,
      })
    )

    return { id: result.id }
  }) as any
)

// 获取转账详情
const getAccountTransferRoute = createRoute({
  method: 'get',
  path: '/account-transfers/{id}',
  summary: 'Get account transfer detail',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: accountTransferResponseSchema,
          }),
        },
      },
      description: 'Account transfer detail',
    },
  },
})

accountTransfersRoutes.openapi(
  getAccountTransferRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireTransferPermission(c, 'view')

    const { id } = c.req.valid('param')

    const row = await c.var.services.accountTransfer.getById(id)
    if (!row) {
      throw Errors.NOT_FOUND()
    }

    const result = {
      ...row.transfer,
      fromCurrency: row.fromAccountCurrency || 'CNY',
      toCurrency: row.toAccountCurrency || 'CNY',
      fromAccountName: row.fromAccountName,
      fromAccountCurrency: row.fromAccountCurrency,
      toAccountName: row.toAccountName,
      toAccountCurrency: row.toAccountCurrency,
    }

    return result
  }) as any
)
