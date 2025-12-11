import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission, getUserPosition } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createVendorSchema, updateVendorSchema, vendorSchema } from '../../schemas/master-data.schema.js'

export const vendorsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listVendorsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取供应商列表',
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
            results: z.array(vendorSchema)
          })
        }
      },
      description: '供应商列表'
    }
  }
})

vendorsRoutes.openapi(listVendorsRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const { activeOnly, search } = c.req.valid('query')
  const service = c.get('services').masterData
  let results = await service.getVendors()

  // 后端过滤
  if (activeOnly === 'true') {
    results = results.filter(r => r.active === 1)
  }
  if (search) {
    const s = search.toLowerCase()
    results = results.filter(r => r.name.toLowerCase().includes(s))
  }

  return c.json({
    results: results.map(r => ({
      ...r,
      active: r.active ?? 1
    }))
  })
})

const getVendorRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: '获取供应商详情',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: vendorSchema
        }
      },
      description: '供应商详情'
    }
  }
})

vendorsRoutes.openapi(getVendorRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').masterData
  const result = await service.getVendor(id)
  return c.json({
    ...result,
    active: result.active ?? 1
  })
})

const createVendorRoute = createRoute({
  method: 'post',
  path: '/',
  summary: '创建供应商',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createVendorSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: vendorSchema
        }
      },
      description: '创建成功'
    }
  }
})

vendorsRoutes.openapi(createVendorRoute, async (c) => {
  if (!hasPermission(c, 'system', 'vendor', 'create')) throw Errors.FORBIDDEN()
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  const result = await service.createVendor({
    name: body.name,
    contact: body.contact || undefined,
    phone: body.phone || undefined,
    email: body.email || undefined,
    address: body.address || undefined,
    memo: body.memo || undefined
  })

  logAuditAction(c, 'create', 'vendor', result.id, JSON.stringify({ name: body.name }))
  return c.json({
    ...result,
    active: result.active ?? 1
  })
})

const updateVendorRoute = createRoute({
  method: 'put',
  path: '/{id}',
  summary: '更新供应商',
  request: {
    params: z.object({
      id: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: updateVendorSchema
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

vendorsRoutes.openapi(updateVendorRoute, async (c) => {
  if (!hasPermission(c, 'system', 'vendor', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  await service.updateVendor(id, {
    ...body,
    contact: body.contact ?? undefined,
    phone: body.phone ?? undefined,
    email: body.email ?? undefined,
    address: body.address ?? undefined,
    memo: body.memo ?? undefined,
    active: body.active ?? undefined
  })

  logAuditAction(c, 'update', 'vendor', id, JSON.stringify({ name: body.name }))
  return c.json({ ok: true })
})

const deleteVendorRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  summary: '删除供应商',
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

vendorsRoutes.openapi(deleteVendorRoute, async (c) => {
  if (!hasPermission(c, 'system', 'vendor', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').masterData

  const result = await service.deleteVendor(id)

  logAuditAction(c, 'delete', 'vendor', id, JSON.stringify({ name: result.name }))
  return c.json({ ok: true })
})
