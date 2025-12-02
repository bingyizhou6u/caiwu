import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createAccountSchema, updateAccountSchema, accountSchema, accountTransactionSchema } from '../../schemas/master-data.schema.js'

export const accountsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listAccountsRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取账户列表',
    request: {
        query: z.object({
            search: z.string().optional()
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(accountSchema.extend({ currency_name: z.string().optional() }))
                    })
                }
            },
            description: '账户列表'
        }
    }
})

accountsRoutes.openapi(listAccountsRoute, async (c) => {
    const search = c.req.query('search')
    const service = c.get('services').masterData
    const results = await service.getAccounts(search)

    const mappedResults = results.map(r => ({
        id: r.id,
        name: r.name,
        type: r.type as any,
        currency: r.currency,
        alias: r.alias,
        account_number: r.accountNumber,
        opening_cents: r.openingCents,
        active: r.active,
        currency_name: r.currencyName || undefined
    }))

    return c.json({ results: mappedResults })
})

const listAccountTransactionsRoute = createRoute({
    method: 'get',
    path: '/{id}/transactions',
    summary: '获取账户交易记录',
    request: {
        params: z.object({
            id: z.string()
        }),
        query: z.object({
            limit: z.string().optional().default('100'),
            offset: z.string().optional().default('0')
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(accountTransactionSchema)
                    })
                }
            },
            description: '交易记录'
        }
    }
})

accountsRoutes.openapi(listAccountTransactionsRoute, async (c) => {
    const id = c.req.param('id')
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')

    const service = c.get('services').masterData
    const results = await service.getAccountTransactions(id, limit, offset)

    const mappedResults = results.map(r => ({
        id: r.id,
        transaction_date: r.transactionDate,
        transaction_type: r.transactionType,
        amount_cents: r.amountCents,
        balance_before_cents: r.balanceBeforeCents,
        balance_after_cents: r.balanceAfterCents,
        created_at: r.createdAt || 0,
        voucher_no: r.voucherNo,
        memo: r.memo,
        counterparty: r.counterparty,
        voucher_url: r.voucherUrl,
        category_name: r.categoryName
    }))

    return c.json({ results: mappedResults })
})

const createAccountRoute = createRoute({
    method: 'post',
    path: '/',
    summary: '创建账户',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createAccountSchema.extend({ manager: z.string().optional() })
                }
            }
        }
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: accountSchema
                }
            },
            description: '创建成功'
        }
    }
})

accountsRoutes.openapi(createAccountRoute, async (c) => {
    if (!hasPermission(c, 'system', 'account', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const service = c.get('services').masterData

    const result = await service.createAccount({
        name: body.name,
        type: body.type,
        currency: body.currency,
        alias: body.alias || undefined,
        accountNumber: body.account_number || undefined,
        openingCents: body.opening_cents,
        manager: body.manager
    })

    logAuditAction(c, 'create', 'account', result.id, JSON.stringify({ name: body.name, type: body.type, currency: result.currency }))

    return c.json({
        id: result.id,
        name: result.name,
        type: result.type as any,
        currency: result.currency,
        alias: result.alias,
        account_number: result.accountNumber,
        opening_cents: result.openingCents,
        active: 1
    })
})

const updateAccountRoute = createRoute({
    method: 'put',
    path: '/{id}',
    summary: '更新账户',
    request: {
        params: z.object({
            id: z.string()
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateAccountSchema.extend({ manager: z.string().optional() })
                }
            }
        }
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ ok: z.boolean() })
                }
            },
            description: '更新成功'
        }
    }
})

accountsRoutes.openapi(updateAccountRoute, async (c) => {
    if (!hasPermission(c, 'system', 'account', 'update')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.get('services').masterData

    await service.updateAccount(id, {
        name: body.name,
        type: body.type,
        currency: body.currency,
        alias: body.alias || undefined,
        accountNumber: body.account_number || undefined,
        active: body.active,
        manager: body.manager
    })

    logAuditAction(c, 'update', 'account', id, JSON.stringify(body))
    return c.json({ ok: true })
})

const deleteAccountRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: '删除账户',
    request: {
        params: z.object({
            id: z.string()
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ ok: z.boolean() })
                }
            },
            description: '删除成功'
        }
    }
})

accountsRoutes.openapi(deleteAccountRoute, async (c) => {
    if (!hasPermission(c, 'system', 'account', 'delete')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const service = c.get('services').masterData

    const result = await service.deleteAccount(id)

    logAuditAction(c, 'delete', 'account', id, JSON.stringify({ name: result.name }))
    return c.json({ ok: true })
})
