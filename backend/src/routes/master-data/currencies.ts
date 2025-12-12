import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createCurrencySchema, updateCurrencySchema, currencySchema } from '../../schemas/master-data.schema.js'

export const currenciesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listCurrenciesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取币种列表',
    request: {
        query: z.object({
            activeOnly: z.string().optional(),
            search: z.string().optional()
        })
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(currencySchema)
                    })
                }
            },
            description: '币种列表'
        }
    }
})

currenciesRoutes.openapi(listCurrenciesRoute, async (c) => {
    const { activeOnly, search } = c.req.valid('query')
    const service = c.var.services.masterData
    let results = await service.getCurrencies(search)

    // 后端过滤
    if (activeOnly === 'true') {
        results = results.filter(r => r.active === 1)
    }

    return c.json({ results })
})

const createCurrencyRoute = createRoute({
    method: 'post',
    path: '/',
    summary: '创建币种',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createCurrencySchema
                }
            }
        }
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: currencySchema
                }
            },
            description: '创建成功'
        }
    }
})

currenciesRoutes.openapi(createCurrencyRoute, async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    const result = await service.createCurrency({
        code: body.code,
        name: body.name
    })

    logAuditAction(c, 'create', 'currency', result.code, JSON.stringify({ name: body.name }))

    return c.json({
        code: result.code,
        name: result.name,
        active: 1
    })
})

const updateCurrencyRoute = createRoute({
    method: 'put',
    path: '/{code}',
    summary: '更新币种',
    request: {
        params: z.object({
            code: z.string()
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateCurrencySchema
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

currenciesRoutes.openapi(updateCurrencyRoute, async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'update')) throw Errors.FORBIDDEN()
    const code = c.req.param('code')
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    await service.updateCurrency(code, {
        name: body.name,
        active: body.active ?? undefined
    })

    logAuditAction(c, 'update', 'currency', code, JSON.stringify(body))
    return c.json({ ok: true })
})

const deleteCurrencyRoute = createRoute({
    method: 'delete',
    path: '/{code}',
    summary: '删除币种',
    request: {
        params: z.object({
            code: z.string()
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

currenciesRoutes.openapi(deleteCurrencyRoute, async (c) => {
    if (!hasPermission(c, 'system', 'currency', 'delete')) throw Errors.FORBIDDEN()
    const code = c.req.param('code')
    const service = c.var.services.masterData

    const result = await service.deleteCurrency(code)

    logAuditAction(c, 'delete', 'currency', code, JSON.stringify({ name: result.name }))
    return c.json({ ok: true })
})
