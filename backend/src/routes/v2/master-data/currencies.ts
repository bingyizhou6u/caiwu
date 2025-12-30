import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { createPermissionContext } from '../../../utils/permission-context.js'
import { PermissionModule, PermissionAction } from '../../../constants/permissions.js'
import { logAuditAction } from '../../../utils/audit.js'
import { Errors } from '../../../utils/errors.js'
import {
  createCurrencySchema,
  updateCurrencySchema,
  currencySchema,
} from '../../../schemas/master-data.schema.js'
import { apiSuccess, jsonResponse } from '../../../utils/response.js'
import { createQueryCache, cacheKeys, cacheTTL } from '../../../utils/query-cache.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

export const currenciesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：检查权限并返回 PermissionContext
 */
function requireCurrencyPermission(c: any, action: string): ReturnType<typeof createPermissionContext> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission(PermissionModule.SYSTEM, 'currency', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

const listCurrenciesRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取币种列表',
  request: {
    query: z.object({
      activeOnly: z.string().optional(),
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
              results: z.array(currencySchema),
            }),
          }),
        },
      },
      description: '币种列表',
    },
  },
})

currenciesRoutes.openapi(
  listCurrenciesRoute,
  createRouteHandler(async (c: any) => {
    const { activeOnly, search } = c.req.valid('query') as { activeOnly?: string; search?: string }

    // 缓存由 Service 层 (KVCachedMasterDataService) 处理
    const service = c.var.services.masterData
    let results = await service.getCurrencies(search)

    // 后端过滤
    if (activeOnly === 'true') {
      results = (results || []).filter((r: any) => r.active === 1)
    }

    return { results }
  })
)

const createCurrencyRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建币种',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCurrencySchema,
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
            data: currencySchema,
          }),
        },
      },
      description: '创建成功',
    },
  },
})

currenciesRoutes.openapi(
  createCurrencyRoute,
  createRouteHandler(async (c: any) => {
    requireCurrencyPermission(c, PermissionAction.CREATE)
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    const result = await service.createCurrency({
      code: body.code,
      name: body.name,
    })

    logAuditAction(c, 'create', 'currency', result.code, JSON.stringify({ name: body.name }))

    return {
      code: result.code,
      name: result.name,
      active: 1,
    }
  }) as any
)

const updateCurrencyRoute = createRoute({
  method: 'put',
  path: '/{code}',
  summary: '更新币种',
  request: {
    params: z.object({
      code: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateCurrencySchema,
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

currenciesRoutes.openapi(
  updateCurrencyRoute,
  createRouteHandler(async (c: any) => {
    requireCurrencyPermission(c, PermissionAction.UPDATE)
    const code = c.req.param('code')
    const body = c.req.valid('json')
    const service = c.var.services.masterData

    await service.updateCurrency(code, {
      name: body.name,
      active: body.active ?? undefined,
    })

    logAuditAction(c, 'update', 'currency', code, JSON.stringify(body))
    return {}
  }) as any
)

const deleteCurrencyRoute = createRoute({
  method: 'delete',
  path: '/{code}',
  summary: '删除币种',
  request: {
    params: z.object({
      code: z.string(),
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

currenciesRoutes.openapi(
  deleteCurrencyRoute,
  createRouteHandler(async (c: any) => {
    requireCurrencyPermission(c, PermissionAction.DELETE)
    const code = c.req.param('code')
    const service = c.var.services.masterData

    const result = await service.deleteCurrency(code)

    logAuditAction(c, 'delete', 'currency', code, JSON.stringify({ name: result.name }))
    return {}
  }) as any
)

// --- Batch Operations ---

import { batchOperationSchema, batchResponseSchema } from '../../../schemas/batch.schema.js'

const batchCurrenciesRoute = createRoute({
  method: 'post',
  path: '/batch',
  summary: '批量操作币种',
  request: {
    body: {
      content: {
        'application/json': {
          schema: batchOperationSchema,
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
            data: batchResponseSchema,
          }),
        },
      },
      description: '批量操作结果',
    },
  },
})

currenciesRoutes.openapi(
  batchCurrenciesRoute,
  createRouteHandler(async (c: any) => {
    // 权限检查：简单起见，只要有 update 权限就可以执行 batch (包括 delete)
    // 更细粒度的控制可以在 service 内部或这里根据 operation 类型拆分
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.SYSTEM, 'currency', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }

    const body = c.req.valid('json')
    const service = c.var.services.masterData

    // 如果是 delete 操作，需要检查 delete 权限
    if (body.operation === 'delete' && !permCtx.hasPermission(PermissionModule.SYSTEM, 'currency', PermissionAction.DELETE)) {
      throw Errors.FORBIDDEN()
    }

    const { ids, operation } = body
    const result = await service.batchOperation('currency', ids, operation)

    logAuditAction(
      c,
      'batch',
      'currency',
      operation,
      JSON.stringify({ count: ids.length, success: result.successCount })
    )
    return result
  }) as any
)
