import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types.js'
import { hasPermission } from '../../../utils/permissions.js'
import { logAuditAction } from '../../../utils/audit.js'
import { Errors } from '../../../utils/errors.js'
import {
  createAccountSchema,
  updateAccountSchema,
  accountSchema,
  accountTransactionSchema,
} from '../../../schemas/master-data.schema.js'
import { paginationSchema } from '../../../schemas/common.schema.js'
import { apiSuccess } from '../../../utils/response.js'
import { getPagination } from '../../../utils/pagination.js'
import { createRouteHandler, createPaginatedHandler, parsePagination } from '../../../utils/route-helpers.js'

export const accountsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const listAccountsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取账户列表',
  request: {
    query: z.object({
      activeOnly: z.string().optional(),
      accountType: z.string().optional(),
      currency: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(accountSchema.extend({ currencyName: z.string().optional() })),
            }),
          }),
        },
      },
      description: '账户列表',
    },
  },
})

accountsRoutes.openapi(
  listAccountsRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'account', 'view')) {
      throw Errors.FORBIDDEN()
    }
    const { activeOnly, accountType, currency, search } = c.req.valid('query')
    const service = c.var.services.masterData
    let results = await service.getAccounts(search)

    // 后端过滤
    if (activeOnly === 'true') {
      results = results.filter((r: any) => r.active === 1)
    }
    if (accountType) {
      results = results.filter((r: any) => r.type === accountType)
    }
    if (currency) {
      results = results.filter((r: any) => r.currency === currency)
    }

    const mappedResults = results.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type as any,
      currency: r.currency,
      alias: r.alias,
      accountNumber: r.accountNumber,
      openingCents: r.openingCents,
      active: r.active,
      currencyName: r.currencyName || undefined,
    }))

    return { results: mappedResults }
  }) as any
)

const listAccountTransactionsRoute = createRoute({
  method: 'get',
  path: '/{id}/transactions',
  summary: '获取账户交易记录',
  request: {
    params: z.object({
      id: z.string(),
    }),
    query: paginationSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              items: z.array(accountTransactionSchema),
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
      description: '交易记录',
    },
  },
})

accountsRoutes.openapi(
  listAccountTransactionsRoute,
  createPaginatedHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'account', 'view')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const { page, limit } = parsePagination(c)

    const service = c.var.services.masterData
    const { total, list } = await service.getAccountTransactions(id, page, limit)

    const mappedResults = list.map((r: any) => ({
      id: r.id,
      transactionDate: r.transactionDate,
      transactionType: r.transactionType,
      amountCents: r.amountCents,
      balanceBeforeCents: r.balanceBeforeCents,
      balanceAfterCents: r.balanceAfterCents,
      createdAt: r.createdAt || 0,
      voucherNo: r.voucherNo,
      memo: r.memo,
      counterparty: r.counterparty,
      voucherUrl: r.voucherUrl,
      categoryName: r.categoryName,
    }))

    return { items: mappedResults, total }
  }) as any
)

const createAccountRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建账户',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createAccountSchema,
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
            data: accountSchema,
          }),
        },
      },
      description: '创建成功',
    },
  },
})

accountsRoutes.openapi(
  createAccountRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'account', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    const result = await service.createAccount({
      name: body.name,
      type: body.type,
      currency: body.currency,
      alias: body.alias || undefined,
      accountNumber: body.accountNumber || undefined,
      openingCents: body.openingCents ?? 0,
    })

    logAuditAction(
      c,
      'create',
      'account',
      result.id,
      JSON.stringify({ name: body.name, type: body.type, currency: result.currency })
    )

    return {
      id: result.id,
      name: result.name,
      type: result.type as any,
      currency: result.currency,
      alias: result.alias ?? null,
      accountNumber: result.accountNumber ?? null,
      openingCents: result.openingCents ?? 0,
      active: 1,
    }
  }) as any
)

const updateAccountRoute = createRoute({
  method: 'put',
  path: '/{id}',
  summary: '更新账户',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateAccountSchema,
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
            data: z.object({}).optional(),
          }),
        },
      },
      description: '更新成功',
    },
  },
})

accountsRoutes.openapi(
  updateAccountRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'account', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    await service.updateAccount(id, {
      name: body.name,
      type: body.type,
      currency: body.currency,
      alias: body.alias || undefined,
      accountNumber: body.accountNumber || undefined,
      active: body.active ?? undefined,
    })

    logAuditAction(c, 'update', 'account', id, JSON.stringify(body))
    return {}
  }) as any
)

const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: '删除账户',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({}).optional(),
          }),
        },
      },
      description: '删除成功',
    },
  },
})

accountsRoutes.openapi(
  deleteAccountRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'account', 'delete')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.masterData

    const result = await service.deleteAccount(id)

    logAuditAction(c, 'delete', 'account', id, JSON.stringify({ name: result.name }))
    return {}
  }) as any
)
