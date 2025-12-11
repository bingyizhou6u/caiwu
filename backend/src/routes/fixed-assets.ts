import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserEmployee, getUserId } from '../utils/permissions.js'
import { requirePermission, protectRoute } from '../middleware/permission.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import {
  createFixedAssetSchema,
  updateFixedAssetSchema,
  allocateFixedAssetSchema,
  createDepreciationSchema,
  transferFixedAssetSchema,
  purchaseFixedAssetWithFlowSchema,
  sellFixedAssetSchema,
  returnFixedAssetSchema,
  listFixedAssetsResponseSchema,
  listFixedAssetAllocationsResponseSchema,
  fixedAssetResponseSchema
} from '../schemas/business.schema.js'
import {
  fixedAssetQuerySchema,
  fixedAssetAllocationQuerySchema,
  idParamSchema
} from '../schemas/common.schema.js'

export const fixedAssetsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// 列出固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/fixed-assets',
    summary: 'List fixed assets',
    request: {
      query: fixedAssetQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.any()
          }
        },
        description: 'List of fixed assets'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const query = c.req.valid('query')

    // TODO: 如需数据范围过滤请在 Service 中实现，目前 Service 处理基础过滤
    // 原始代码有复杂的数据范围逻辑，可能需要传递给 Service
    // 目前暂时使用 Service 的 list 方法处理基础过滤

    const position = getUserPosition(c)
    const employee = getUserEmployee(c)
    let departmentId = undefined
    let createdBy = undefined

    if (position && employee) {
      if (position.level === 2) {
        departmentId = employee.departmentId || undefined
      } else if (position.level > 2) {
        // 组长和工程师只能看自己创建的（因为表结构不支持组级过滤）
        createdBy = employee.id
      }
    }

    const rows = await c.var.services.fixedAsset.list({
      search: query.search,
      status: query.status,
      category: query.category,
      departmentId,
      createdBy
    })

    // 映射结果键以匹配前端期望
    // Service 返回 camelCase，但为了保险起见，显式映射
    // 保持与原始 SQL 一致
    const results = rows.map(row => ({
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
      createdByName: row.createdByName
    }))

    return c.json({ results })
  }
)

// 列出分类
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/fixed-assets/categories',
    summary: 'List fixed asset categories',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              results: z.array(z.object({ name: z.string().nullable() }))
            })
          }
        },
        description: 'List of categories'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const results = await c.var.services.fixedAsset.getCategories()
    return c.json({ results })
  }
)

// 列出分配记录
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/fixed-assets/allocations',
    summary: 'List fixed asset allocations',
    request: {
      query: fixedAssetAllocationQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.any()
          }
        },
        description: 'List of allocations'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const query = c.req.valid('query')

    const rows = await c.var.services.fixedAsset.listAllocations({
      assetId: query.assetId,
      employeeId: query.employeeId,
      returned: query.returned === 'true' ? true : query.returned === 'false' ? false : undefined
    })

    const results = rows.map(row => ({
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
      createdByName: row.createdByName
    }))

    return c.json({ results })
  }
)

// 获取固定资产详情
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/fixed-assets/{id}',
    summary: 'Get fixed asset details',
    request: {
      params: idParamSchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.any()
          }
        },
        description: 'Fixed asset details'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')

    const asset = await c.var.services.fixedAsset.get(id)
    if (!asset) throw Errors.NOT_FOUND()

    // 映射字段 (保持兼容性)
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
        createdAt: d.createdAt
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
        createdByName: ch.createdByName
      }))
    }

    return c.json(result)
  }
)

// 创建固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets',
    summary: 'Create fixed asset',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createFixedAssetSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              assetCode: z.string()
            })
          }
        },
        description: 'Created fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'create', async (c) => {
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
      createdBy: userId
    })

    logAuditAction(c, 'create', 'fixed_asset', result.id, JSON.stringify({
      assetCode: result.assetCode,
      name: body.name
    }))

    return c.json({ id: result.id, assetCode: result.assetCode })
  })
)

// 更新固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/fixed-assets/{id}',
    summary: 'Update fixed asset',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateFixedAssetSchema
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
        description: 'Updated fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'update', async (c) => {
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
      createdBy: userId
    })

    logAuditAction(c, 'update', 'fixed_asset', id, JSON.stringify(body))

    return c.json({ ok: true })
  })
)

// 删除固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/fixed-assets/{id}',
    summary: 'Delete fixed asset',
    request: {
      params: idParamSchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        },
        description: 'Deleted fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'delete', async (c) => {
    const { id } = c.req.valid('param')

    await c.var.services.fixedAsset.delete(id)

    logAuditAction(c, 'delete', 'fixed_asset', id)

    return c.json({ ok: true })
  })
)

// 创建折旧
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/{id}/depreciation',
    summary: 'Create depreciation',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: createDepreciationSchema
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
        description: 'Created depreciation'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'depreciate', async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.createDepreciation(id, {
      depreciationDate: body.depreciationDate,
      amountCents: body.amountCents,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'depreciate', 'fixed_asset', id, JSON.stringify({
      amountCents: body.amountCents
    }))

    return c.json({ id: result.id })
  })
)

// 转移固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/{id}/transfer',
    summary: 'Transfer fixed asset',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: transferFixedAssetSchema
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
        description: 'Transferred fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'transfer', async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.transfer(id, {
      toDepartmentId: body.toDepartmentId,
      toSiteId: body.toSiteId,
      toCustodian: body.toCustodian,
      transferDate: body.transferDate,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'transfer', 'fixed_asset', id, JSON.stringify({
      toDepartmentId: body.toDepartmentId,
      toSiteId: body.toSiteId,
      toCustodian: body.toCustodian
    }))

    return c.json({ ok: true })
  })
)

// 采购固定资产（生成流水）
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/purchase',
    summary: 'Purchase fixed asset',
    request: {
      body: {
        content: {
          'application/json': {
            schema: purchaseFixedAssetWithFlowSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              id: z.string(),
              assetCode: z.string(),
              flowId: z.string()
            })
          }
        },
        description: 'Purchased fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'create', async (c) => {
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
      createdBy: userId
    })

    logAuditAction(c, 'purchase', 'fixed_asset', result.id, JSON.stringify({
      assetCode: result.assetCode,
      amountCents: body.purchasePriceCents
    }))

    return c.json({
      id: result.id,
      assetCode: result.assetCode,
      flowId: result.flowId
    })
  })
)

// 变卖固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/{id}/sell',
    summary: 'Sell fixed asset',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: sellFixedAssetSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              flowId: z.string()
            })
          }
        },
        description: 'Sold fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'dispose', async (c) => {
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
      createdBy: userId
    })

    logAuditAction(c, 'sell', 'fixed_asset', id, JSON.stringify({
      salePriceCents: body.salePriceCents
    }))

    return c.json({
      ok: true,
      flowId: result.flowId
    })
  })
)

// 分配固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/allocate',
    summary: 'Allocate fixed asset',
    request: {
      body: {
        content: {
          'application/json': {
            schema: allocateFixedAssetSchema
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
        description: 'Allocated fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'allocate', async (c) => {
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.allocate(body.assetId, {
      employeeId: body.employeeId,
      allocationDate: body.allocationDate,
      allocationType: body.allocationType,
      expectedReturnDate: body.expectedReturnDate,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'allocate', 'fixed_asset', body.assetId, JSON.stringify({
      employeeId: body.employeeId
    }))

    return c.json({ id: result.id })
  })
)

// 归还固定资产
fixedAssetsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/fixed-assets/{id}/return',
    summary: 'Return fixed asset',
    request: {
      params: idParamSchema,
      body: {
        content: {
          'application/json': {
            schema: returnFixedAssetSchema
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
        description: 'Returned fixed asset'
      }
    }
  }),
  protectRoute('asset', 'fixed', 'allocate', async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.return(id, {
      returnDate: body.returnDate,
      returnType: body.returnType,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'return', 'fixed_asset', id, JSON.stringify({
      returnDate: body.returnDate
    }))

    return c.json({ ok: true })
  })
)
