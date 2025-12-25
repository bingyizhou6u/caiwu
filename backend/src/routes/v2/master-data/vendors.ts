import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../../types/index.js'
import { hasPermission, getUserPosition } from '../../../utils/permissions.js'
import { logAuditAction } from '../../../utils/audit.js'
import { Errors } from '../../../utils/errors.js'
import {
  createVendorSchema,
  updateVendorSchema,
  vendorSchema,
} from '../../../schemas/master-data.schema.js'
import { apiSuccess, jsonResponse } from '../../../utils/response.js'
import { createRouteHandler } from '../../../utils/route-helpers.js'

export const vendorsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const listVendorsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取供应商列表',
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
              results: z.array(vendorSchema),
            }),
          }),
        },
      },
      description: '供应商列表',
    },
  },
})

vendorsRoutes.openapi(
  listVendorsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { activeOnly, search } = c.req.valid('query') as { activeOnly?: string; search?: string }
    const service = c.var.services.masterData
    let results = await service.getVendors()

    // 后端过滤
    if (activeOnly === 'true') {
      results = results.filter((r: any) => r.active === 1)
    }
    if (search) {
      const s = search.toLowerCase()
      results = results.filter((r: any) => r.name.toLowerCase().includes(s))
    }

    const mappedResults = results.map((r: any) => ({
      ...r,
      active: r.active ?? 1,
    }))

    return { results: mappedResults }
  })
)

const getVendorRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: '获取供应商详情',
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
            data: vendorSchema,
          }),
        },
      },
      description: '供应商详情',
    },
  },
})

vendorsRoutes.openapi(
  getVendorRoute,
  createRouteHandler(async c => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.masterData
    const result = await service.getVendor(id)
    return {
      ...result,
      active: result.active ?? 1,
    }
  })
)

const createVendorRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建供应商',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createVendorSchema,
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
            data: vendorSchema,
          }),
        },
      },
      description: '创建成功',
    },
  },
})

vendorsRoutes.openapi(
  createVendorRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'vendor', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json') as { name: string; contact?: string; phone?: string; email?: string; address?: string; memo?: string }
    const service = c.var.services.masterData

    const result = await service.createVendor({
      name: body.name,
      contact: body.contact || undefined,
      phone: body.phone || undefined,
      email: body.email || undefined,
      address: body.address || undefined,
      memo: body.memo || undefined,
    })

    logAuditAction(c, 'create', 'vendor', result.id, JSON.stringify({ name: body.name }))
    return {
      ...result,
      active: result.active ?? 1,
    }
  })
)

const updateVendorRoute = createRoute({
  method: 'put',
  path: '/{id}',
  summary: '更新供应商',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateVendorSchema,
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

vendorsRoutes.openapi(
  updateVendorRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'system', 'vendor', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json') as any
    const service = c.var.services.masterData

    await service.updateVendor(id, {
      ...body,
      contact: body.contact ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      address: body.address ?? undefined,
      memo: body.memo ?? undefined,
      active: body.active ?? undefined,
    })

    logAuditAction(c, 'update', 'vendor', id, JSON.stringify({ name: body.name }))
    return {}
  })
)

const deleteVendorRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: '删除供应商',
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

vendorsRoutes.openapi(
  deleteVendorRoute,
  createRouteHandler(async c => {
    if (!hasPermission(c, 'system', 'vendor', 'delete')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.masterData

    const result = await service.deleteVendor(id)

    logAuditAction(c, 'delete', 'vendor', id, JSON.stringify({ name: result.name }))
    return {}
  })
)
