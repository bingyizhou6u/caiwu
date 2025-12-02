import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserId } from '../utils/permissions.js'
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

// List Fixed Assets
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
            schema: listFixedAssetsResponseSchema
          }
        },
        description: 'List of fixed assets'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()
    const query = c.req.valid('query')

    // TODO: Implement data access filter in service if needed, currently service handles basic filters
    // The original code had complex scope filtering which might need to be passed to service
    // For now, we'll use the service's list method which handles basic filters

    const rows = await c.var.services.fixedAsset.list({
      search: query.search,
      status: query.status,
      departmentId: query.department_id,
      category: query.category
    })

    // Map result keys to match frontend expectations (camelCase to snake_case if needed, or keep as is)
    // The service returns camelCase keys from Drizzle, but frontend might expect snake_case
    // Let's map them to be safe and consistent with original SQL
    const results = rows.map(row => ({
      id: row.asset.id,
      asset_code: row.asset.assetCode,
      name: row.asset.name,
      category: row.asset.category,
      purchase_date: row.asset.purchaseDate,
      purchase_price_cents: row.asset.purchasePriceCents,
      currency: row.asset.currency,
      vendor_id: row.asset.vendorId,
      department_id: row.asset.departmentId,
      site_id: row.asset.siteId,
      custodian: row.asset.custodian,
      status: row.asset.status,
      depreciation_method: row.asset.depreciationMethod,
      useful_life_years: row.asset.usefulLifeYears,
      current_value_cents: row.asset.currentValueCents,
      memo: row.asset.memo,
      created_by: row.asset.createdBy,
      created_at: row.asset.createdAt,
      updated_at: row.asset.updatedAt,
      department_name: row.departmentName,
      site_name: row.siteName,
      vendor_name: row.vendorName,
      currency_name: row.currencyName,
      created_by_name: row.createdByName
    }))

    return c.json({ results })
  }
)

// List Categories
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

// List Allocations
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
            schema: listFixedAssetAllocationsResponseSchema
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
      assetId: query.asset_id,
      employeeId: query.employee_id,
      returned: query.returned === 'true' ? true : query.returned === 'false' ? false : undefined
    })

    const results = rows.map(row => ({
      id: row.allocation.id,
      asset_id: row.allocation.assetId,
      employee_id: row.allocation.employeeId,
      allocation_date: row.allocation.allocationDate,
      allocation_type: row.allocation.allocationType,
      return_date: row.allocation.returnDate,
      return_type: row.allocation.returnType,
      memo: row.allocation.memo,
      created_by: row.allocation.createdBy,
      created_at: row.allocation.createdAt,
      updated_at: row.allocation.updatedAt,
      asset_code: row.assetCode,
      asset_name: row.assetName,
      employee_name: row.employeeName,
      employee_department_id: row.employeeDepartmentId,
      employee_department_name: row.employeeDepartmentName,
      created_by_name: row.createdByName
    }))

    return c.json({ results })
  }
)

// Get Fixed Asset
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
            schema: fixedAssetResponseSchema
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

    // Map to snake_case
    const result = {
      id: asset.id,
      asset_code: asset.assetCode,
      name: asset.name,
      category: asset.category,
      purchase_date: asset.purchaseDate,
      purchase_price_cents: asset.purchasePriceCents,
      currency: asset.currency,
      vendor_id: asset.vendorId,
      department_id: asset.departmentId,
      site_id: asset.siteId,
      custodian: asset.custodian,
      status: asset.status,
      depreciation_method: asset.depreciationMethod,
      useful_life_years: asset.usefulLifeYears,
      current_value_cents: asset.currentValueCents,
      memo: asset.memo,
      created_by: asset.createdBy,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
      department_name: asset.departmentName,
      site_name: asset.siteName,
      vendor_name: asset.vendorName,
      currency_name: asset.currencyName,
      created_by_name: asset.createdByName,
      depreciations: asset.depreciations.map((d: any) => ({
        id: d.id,
        asset_id: d.assetId,
        depreciation_date: d.depreciationDate,
        depreciation_amount_cents: d.depreciationAmountCents,
        accumulated_depreciation_cents: d.accumulatedDepreciationCents,
        remaining_value_cents: d.remainingValueCents,
        memo: d.memo,
        created_by: d.createdBy,
        created_at: d.createdAt
      })),
      changes: asset.changes.map((ch: any) => ({
        id: ch.id,
        asset_id: ch.assetId,
        change_type: ch.changeType,
        change_date: ch.changeDate,
        from_dept_id: ch.fromDeptId,
        to_dept_id: ch.toDeptId,
        from_site_id: ch.fromSiteId,
        to_site_id: ch.toSiteId,
        from_custodian: ch.fromCustodian,
        to_custodian: ch.toCustodian,
        from_status: ch.fromStatus,
        to_status: ch.toStatus,
        memo: ch.memo,
        created_by: ch.createdBy,
        created_at: ch.createdAt,
        from_dept_name: ch.fromDeptName,
        to_dept_name: ch.toDeptName,
        from_site_name: ch.fromSiteName,
        to_site_name: ch.toSiteName,
        created_by_name: ch.createdByName
      }))
    }

    return c.json(result)
  }
)

// Create Fixed Asset
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
              asset_code: z.string()
            })
          }
        },
        description: 'Created fixed asset'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.create({
      assetCode: body.asset_code,
      name: body.name,
      category: body.category,
      purchaseDate: body.purchase_date,
      purchasePriceCents: body.purchase_price_cents,
      currency: body.currency,
      departmentId: body.department_id,
      siteId: body.site_id,
      vendorId: body.vendor_id,
      custodian: body.custodian,
      status: body.status || 'in_use',
      depreciationMethod: body.depreciation_method,
      usefulLifeYears: body.useful_life_years,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'create', 'fixed_asset', result.id, JSON.stringify({
      asset_code: result.assetCode,
      name: body.name
    }))

    return c.json({ id: result.id, asset_code: result.assetCode })
  }
)

// Update Fixed Asset
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'update')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.update(id, {
      name: body.name,
      category: body.category,
      purchaseDate: body.purchase_date,
      purchasePriceCents: body.purchase_price_cents,
      currency: body.currency,
      departmentId: body.department_id,
      siteId: body.site_id,
      vendorId: body.vendor_id,
      custodian: body.custodian,
      status: body.status,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'update', 'fixed_asset', id, JSON.stringify(body))

    return c.json({ ok: true })
  }
)

// Delete Fixed Asset
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'delete')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')

    await c.var.services.fixedAsset.delete(id)

    logAuditAction(c, 'delete', 'fixed_asset', id)

    return c.json({ ok: true })
  }
)

// Create Depreciation
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'depreciate')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.createDepreciation(id, {
      depreciationDate: body.depreciation_date,
      amountCents: body.amount_cents,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'depreciate', 'fixed_asset', id, JSON.stringify({
      amount_cents: body.amount_cents
    }))

    return c.json({ id: result.id })
  }
)

// Transfer Fixed Asset
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'transfer')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.transfer(id, {
      toDepartmentId: body.to_department_id,
      toSiteId: body.to_site_id,
      toCustodian: body.to_custodian,
      transferDate: body.transfer_date,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'transfer', 'fixed_asset', id, JSON.stringify({
      to_department_id: body.to_department_id,
      to_site_id: body.to_site_id,
      to_custodian: body.to_custodian
    }))

    return c.json({ ok: true })
  }
)

// Purchase Fixed Asset (with Flow)
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
              asset_code: z.string(),
              flow_id: z.string()
            })
          }
        },
        description: 'Purchased fixed asset'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.purchase({
      assetCode: body.asset_code,
      name: body.name,
      category: body.category,
      purchaseDate: body.purchase_date,
      purchasePriceCents: body.purchase_price_cents,
      currency: body.currency,
      accountId: body.account_id,
      categoryId: body.category_id,
      vendorId: body.vendor_id,
      departmentId: body.department_id,
      siteId: body.site_id,
      custodian: body.custodian,
      memo: body.memo,
      voucherUrl: body.voucher_url,
      depreciationMethod: body.depreciation_method,
      usefulLifeYears: body.useful_life_years,
      createdBy: userId
    })

    logAuditAction(c, 'purchase', 'fixed_asset', result.id, JSON.stringify({
      asset_code: result.assetCode,
      amount_cents: body.purchase_price_cents
    }))

    return c.json({
      id: result.id,
      asset_code: result.assetCode,
      flow_id: result.flowId
    })
  }
)

// Sell Fixed Asset
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
              flow_id: z.string()
            })
          }
        },
        description: 'Sold fixed asset'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'dispose')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.sell(id, {
      saleDate: body.sale_date,
      salePriceCents: body.sale_price_cents,
      currency: body.currency,
      accountId: body.account_id,
      categoryId: body.category_id,
      voucherUrl: body.voucher_url,
      saleBuyer: body.sale_buyer,
      saleMemo: body.sale_memo,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'sell', 'fixed_asset', id, JSON.stringify({
      sale_price_cents: body.sale_price_cents
    }))

    return c.json({
      ok: true,
      flow_id: result.flowId
    })
  }
)

// Allocate Fixed Asset
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'allocate')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const userId = getUserId(c)

    const result = await c.var.services.fixedAsset.allocate(body.asset_id, {
      employeeId: body.employee_id,
      allocationDate: body.allocation_date,
      allocationType: body.allocation_type,
      expectedReturnDate: body.expected_return_date,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'allocate', 'fixed_asset', body.asset_id, JSON.stringify({
      employee_id: body.employee_id
    }))

    return c.json({ id: result.id })
  }
)

// Return Fixed Asset
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
  async (c) => {
    if (!hasPermission(c, 'asset', 'fixed', 'allocate')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const userId = getUserId(c)

    await c.var.services.fixedAsset.return(id, {
      returnDate: body.return_date,
      returnType: body.return_type,
      memo: body.memo,
      createdBy: userId
    })

    logAuditAction(c, 'return', 'fixed_asset', id, JSON.stringify({
      return_date: body.return_date
    }))

    return c.json({ ok: true })
  }
)
