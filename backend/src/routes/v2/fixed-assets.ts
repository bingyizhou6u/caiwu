import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import {
  hasPermission,
  getUserPosition,
  getUserEmployee,
  getUserId,
} from '../../utils/permissions.js'
import { requirePermission, protectRoute } from '../../middleware/permission.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import {
  createFixedAssetSchema,
  updateFixedAssetSchema,
  allocateFixedAssetSchema,
  createDepreciationSchema,
  transferFixedAssetSchema,
  purchaseFixedAssetWithFlowSchema,
  sellFixedAssetSchema,
  returnFixedAssetSchema,
} from '../../schemas/business.schema.js'
import {
  fixedAssetQuerySchema,
  fixedAssetAllocationQuerySchema,
  idParamSchema,
} from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const fixedAssetsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 列出固定资产
const listFixedAssetsRoute = createRoute({
  method: 'get',
  path: '/fixed-assets',
  summary: 'List fixed assets',
  request: {
    query: fixedAssetQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(z.any()),
            }),
          }),
        },
      },
      description: 'List of fixed assets',
    },
  },
})

fixedAssetsRoutes.openapi(
  listFixedAssetsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const query = c.req.valid('query')

    const position = getUserPosition(c)
    const employee = getUserEmployee(c)
    let departmentId = undefined
    let createdBy = undefined

    if (position && employee) {
      if (position.dataScope === 'project') {
        departmentId = employee.departmentId || undefined
      } else if (position.dataScope === 'group' || position.dataScope === 'self') {
        createdBy = employee.id
      }
    }

    const rows = await c.var.services.fixedAsset.list({
      search: query.search,
      status: query.status,
      category: query.category,
      departmentId,
      createdBy,
    })

    const results = rows.map((row: any) => ({
      id: row.asset.id,
      assetCode: row.asset.assetCode,
      name: row.asset.name,
      category: row.asset.category,
      purchaseDate: row.asset.purchaseDate,
      purchasePriceCents: row.asset.purchasePriceCents,
      currency: row.asset.currency,
      vendorId: row.asset.vendorId,
      departmentId: row.asset.departmentId,
      siteId: row.asset.siteId,
      custodian: row.asset.custodian,
      status: row.asset.status,
      depreciationMethod: row.asset.depreciationMethod,
      usefulLifeYears: row.asset.usefulLifeYears,
      currentValueCents: row.asset.currentValueCents,
      memo: row.asset.memo,
      createdBy: row.asset.createdBy,
      createdAt: row.asset.createdAt,
      updatedAt: row.asset.updatedAt,
      departmentName: row.departmentName,
      siteName: row.siteName,
      vendorName: row.vendorName,
      currencyName: row.currencyName,
      createdByName: row.createdByName,
    }))

    return { results }
  }) as any
)

// 列出分类
const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/fixed-assets/categories',
  summary: 'List fixed asset categories',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(z.object({ name: z.string().nullable() })),
            }),
          }),
        },
      },
      description: 'List of categories',
    },
  },
})

fixedAssetsRoutes.openapi(
  listCategoriesRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const results = await c.var.services.fixedAsset.getCategories()
    return { results }
  }) as any
)

// 列出分配记录
const listAllocationsRoute = createRoute({
  method: 'get',
  path: '/fixed-assets/allocations',
  summary: 'List fixed asset allocations',
  request: {
    query: fixedAssetAllocationQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(z.any()),
            }),
          }),
        },
      },
      description: 'List of allocations',
    },
  },
})

fixedAssetsRoutes.openapi(
  listAllocationsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const query = c.req.valid('query')

    const rows = await c.var.services.fixedAssetAllocation.listAllocations({
      assetId: query.assetId,
      employeeId: query.employeeId,
      returned: query.returned === 'true' ? true : query.returned === 'false' ? false : undefined,
    })

    const results = rows.map((row: any) => ({
      id: row.allocation.id,
      assetId: row.allocation.assetId,
      employeeId: row.allocation.employeeId,
      allocationDate: row.allocation.allocationDate,
      allocationType: row.allocation.allocationType,
      returnDate: row.allocation.returnDate,
      returnType: row.allocation.returnType,
      memo: row.allocation.memo,
      createdBy: row.allocation.createdBy,
      createdAt: row.allocation.createdAt,
      updatedAt: row.allocation.updatedAt,
      assetCode: row.assetCode,
      assetName: row.assetName,
      employeeName: row.employeeName,
      employeeDepartmentId: row.employeeDepartmentId,
      employeeDepartmentName: row.employeeDepartmentName,
      createdByName: row.createdByName,
    }))

    return { results }
  }) as any
)

// 获取固定资产详情
const getFixedAssetRoute = createRoute({
  method: 'get',
  path: '/fixed-assets/{id}',
  summary: 'Get fixed asset details',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'Fixed asset details',
    },
  },
})

fixedAssetsRoutes.openapi(
  getFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')

    const asset = await c.var.services.fixedAsset.get(id)
    if (!asset) {
      throw Errors.NOT_FOUND()
    }

    const result = {
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      category: asset.category,
      purchaseDate: asset.purchaseDate,
      purchasePriceCents: asset.purchasePriceCents,
      currency: asset.currency,
      vendorId: asset.vendorId,
      departmentId: asset.departmentId,
      siteId: asset.siteId,
      custodian: asset.custodian,
      status: asset.status,
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
      currentValueCents: asset.currentValueCents,
      memo: asset.memo,
      createdBy: asset.createdBy,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      departmentName: asset.departmentName,
      siteName: asset.siteName,
      vendorName: asset.vendorName,
      currencyName: asset.currencyName,
      createdByName: asset.createdByName,
      depreciations: asset.depreciations.map((d: any) => ({
        id: d.id,
        assetId: d.assetId,
        depreciationDate: d.depreciationDate,
        depreciationAmountCents: d.depreciationAmountCents,
        accumulatedDepreciationCents: d.accumulatedDepreciationCents,
        remainingValueCents: d.remainingValueCents,
        memo: d.memo,
        createdBy: d.createdBy,
        createdAt: d.createdAt,
      })),
      changes: asset.changes.map((ch: any) => ({
        id: ch.id,
        assetId: ch.assetId,
        changeType: ch.changeType,
        changeDate: ch.changeDate,
        fromDeptId: ch.fromDeptId,
        toDeptId: ch.toDeptId,
        fromSiteId: ch.fromSiteId,
        toSiteId: ch.toSiteId,
        fromCustodian: ch.fromCustodian,
        toCustodian: ch.toCustodian,
        fromStatus: ch.fromStatus,
        toStatus: ch.toStatus,
        memo: ch.memo,
        createdBy: ch.createdBy,
        createdAt: ch.createdAt,
        fromDeptName: ch.fromDeptName,
        toDeptName: ch.toDeptName,
        fromSiteName: ch.fromSiteName,
        toSiteName: ch.toSiteName,
        createdByName: ch.createdByName,
      })),
    }

    return result
  }) as any
)

// 创建固定资产
const createFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets',
  summary: 'Create fixed asset',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createFixedAssetSchema,
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
              assetCode: z.string(),
            }),
          }),
        },
      },
      description: 'Created fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  createFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.create({
      assetCode: body.assetCode,
      name: body.name,
      category: body.category,
      purchaseDate: body.purchaseDate,
      purchasePriceCents: body.purchasePriceCents,
      currency: body.currency,
      departmentId: body.departmentId,
      siteId: body.siteId,
      vendorId: body.vendorId,
      custodian: body.custodian,
      status: body.status || 'in_use',
      depreciationMethod: body.depreciationMethod,
      usefulLifeYears: body.usefulLifeYears,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'create',
      'fixed_asset',
      result.id,
      JSON.stringify({
        assetCode: result.assetCode,
        name: body.name,
      })
    )

    return { id: result.id, assetCode: result.assetCode }
  }) as any
)

// 更新固定资产
const updateFixedAssetRoute = createRoute({
  method: 'put',
  path: '/fixed-assets/{id}',
  summary: 'Update fixed asset',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateFixedAssetSchema,
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
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Updated fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  updateFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.update(id, {
      name: body.name,
      category: body.category,
      purchaseDate: body.purchaseDate,
      purchasePriceCents: body.purchasePriceCents,
      currency: body.currency,
      departmentId: body.departmentId,
      siteId: body.siteId,
      vendorId: body.vendorId,
      custodian: body.custodian,
      status: body.status,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(c, 'update', 'fixed_asset', id, JSON.stringify(body))

    return { ok: true }
  }) as any
)

// 删除固定资产
const deleteFixedAssetRoute = createRoute({
  method: 'delete',
  path: '/fixed-assets/{id}',
  summary: 'Delete fixed asset',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Deleted fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  deleteFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'delete')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')

    await c.var.services.fixedAsset.delete(id)

    logAuditAction(c, 'delete', 'fixed_asset', id)

    return { ok: true }
  }) as any
)

// 创建折旧
const createDepreciationRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/{id}/depreciation',
  summary: 'Create depreciation',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: createDepreciationSchema,
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
            data: z.object({ id: z.string() }),
          }),
        },
      },
      description: 'Created depreciation',
    },
  },
})

fixedAssetsRoutes.openapi(
  createDepreciationRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'depreciate')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAssetDepreciation.createDepreciation(id, {
      depreciationDate: body.depreciationDate,
      amountCents: body.amountCents,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'depreciate',
      'fixed_asset',
      id,
      JSON.stringify({
        amountCents: body.amountCents,
      })
    )

    return { id: result.id }
  }) as any
)

// 转移固定资产
const transferFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/{id}/transfer',
  summary: 'Transfer fixed asset',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: transferFixedAssetSchema,
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
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Transferred fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  transferFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'transfer')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAssetChange.transfer(id, {
      toDepartmentId: body.toDepartmentId,
      toSiteId: body.toSiteId,
      toCustodian: body.toCustodian,
      transferDate: body.transferDate,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'transfer',
      'fixed_asset',
      id,
      JSON.stringify({
        toDepartmentId: body.toDepartmentId,
        toSiteId: body.toSiteId,
        toCustodian: body.toCustodian,
      })
    )

    return { ok: true }
  }) as any
)

// 采购固定资产（生成流水）
const purchaseFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/purchase',
  summary: 'Purchase fixed asset',
  request: {
    body: {
      content: {
        'application/json': {
          schema: purchaseFixedAssetWithFlowSchema,
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
              assetCode: z.string(),
              flowId: z.string(),
            }),
          }),
        },
      },
      description: 'Purchased fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  purchaseFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.purchase({
      assetCode: body.assetCode,
      name: body.name,
      category: body.category,
      purchaseDate: body.purchaseDate,
      purchasePriceCents: body.purchasePriceCents,
      currency: body.currency,
      accountId: body.accountId,
      categoryId: body.categoryId,
      vendorId: body.vendorId,
      departmentId: body.departmentId,
      siteId: body.siteId,
      custodian: body.custodian,
      memo: body.memo,
      voucherUrl: body.voucherUrl,
      depreciationMethod: body.depreciationMethod,
      usefulLifeYears: body.usefulLifeYears,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'purchase',
      'fixed_asset',
      result.id,
      JSON.stringify({
        assetCode: result.assetCode,
        amountCents: body.purchasePriceCents,
      })
    )

    return {
      id: result.id,
      assetCode: result.assetCode,
      flowId: result.flowId,
    }
  }) as any
)

// 变卖固定资产
const sellFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/{id}/sell',
  summary: 'Sell fixed asset',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: sellFixedAssetSchema,
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
              ok: z.boolean(),
              flowId: z.string(),
            }),
          }),
        },
      },
      description: 'Sold fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  sellFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'dispose')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.sell(id, {
      saleDate: body.saleDate,
      salePriceCents: body.salePriceCents,
      currency: body.currency,
      accountId: body.accountId,
      categoryId: body.categoryId,
      voucherUrl: body.voucherUrl,
      saleBuyer: body.saleBuyer,
      saleMemo: body.saleMemo,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'sell',
      'fixed_asset',
      id,
      JSON.stringify({
        salePriceCents: body.salePriceCents,
      })
    )

    return {
      ok: true,
      flowId: result.flowId,
    }
  }) as any
)

// 分配固定资产
const allocateFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/allocate',
  summary: 'Allocate fixed asset',
  request: {
    body: {
      content: {
        'application/json': {
          schema: allocateFixedAssetSchema,
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
            data: z.object({ id: z.string() }),
          }),
        },
      },
      description: 'Allocated fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  allocateFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'allocate')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAssetAllocation.allocate(body.assetId, {
      employeeId: body.employeeId,
      allocationDate: body.allocationDate,
      allocationType: body.allocationType,
      expectedReturnDate: body.expectedReturnDate,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'allocate',
      'fixed_asset',
      body.assetId,
      JSON.stringify({
        employeeId: body.employeeId,
      })
    )

    return { id: result.id }
  }) as any
)

// 归还固定资产
const returnFixedAssetRoute = createRoute({
  method: 'post',
  path: '/fixed-assets/{id}/return',
  summary: 'Return fixed asset',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: returnFixedAssetSchema,
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
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Returned fixed asset',
    },
  },
})

fixedAssetsRoutes.openapi(
  returnFixedAssetRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'fixed', 'allocate')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAssetAllocation.return(id, {
      returnDate: body.returnDate,
      returnType: body.returnType,
      memo: body.memo,
      createdBy: userId,
    })

    logAuditAction(
      c,
      'return',
      'fixed_asset',
      id,
      JSON.stringify({
        returnDate: body.returnDate,
      })
    )

    return { ok: true }
  }) as any
)
