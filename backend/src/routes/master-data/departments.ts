/**
 * 部门和站点路由模块
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createDepartmentSchema, createSiteSchema, updateDepartmentSchema, updateSiteSchema, departmentSchema, siteSchema } from '../../schemas/master-data.schema.js'

export const departmentsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// ========== 部门相关 ==========

const listDepartmentsRoute = createRoute({
  method: 'get',
  path: '/departments',
  summary: '获取部门列表',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(departmentSchema)
          })
        }
      },
      description: '部门列表'
    }
  }
})

departmentsRoutes.openapi(listDepartmentsRoute, async (c) => {
  const masterDataService = c.var.services.masterData
  const results = await masterDataService.getDepartments()
  return c.json({ results })
})

const createDepartmentRoute = createRoute({
  method: 'post',
  path: '/departments',
  summary: '创建部门',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createDepartmentSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: departmentSchema
        }
      },
      description: '创建成功'
    }
  }
})

departmentsRoutes.openapi(createDepartmentRoute, async (c) => {
  if (!hasPermission(c, 'system', 'department', 'create')) throw Errors.FORBIDDEN()
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  // 注意：hq_id vs hqId 映射。Schema 使用 hq_id (snake_case)，service 使用 hqId (camelCase)
  // 我们需要映射它，或者更新 service 以接受 snake_case，或者更新 schema 以使用 camelCase。
  // Schema 定义了 hq_id。Service 期望 hqId。
  const result = await service.createDepartment({
    name: body.name,
    hqId: body.hqId || undefined
  })

  logAuditAction(c, 'create', 'department', result.id, JSON.stringify({ name: body.name, hqId: result.hqId }))

  return c.json({
    id: result.id,
    hqId: result.hqId,
    name: result.name,
    active: 1
  })
})

const updateDepartmentRoute = createRoute({
  method: 'put',
  path: '/departments/{id}',
  summary: '更新部门',
  request: {
    params: z.object({
      id: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: updateDepartmentSchema
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

departmentsRoutes.openapi(updateDepartmentRoute, async (c) => {
  if (!hasPermission(c, 'system', 'department', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  await service.updateDepartment(id, {
    name: body.name,
    hqId: body.hqId || undefined,
    active: body.active ?? undefined
  })

  logAuditAction(c, 'update', 'department', id, JSON.stringify(body))
  return c.json({ ok: true })
})

const deleteDepartmentRoute = createRoute({
  method: 'delete',
  path: '/departments/{id}',
  summary: '删除部门',
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

departmentsRoutes.openapi(deleteDepartmentRoute, async (c) => {
  if (!hasPermission(c, 'system', 'department', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').masterData

  const result = await service.deleteDepartment(id)

  logAuditAction(c, 'delete', 'department', id, JSON.stringify({ name: result.name }))
  return c.json({ ok: true })
})

// ========== 站点相关 ==========

const listSitesRoute = createRoute({
  method: 'get',
  path: '/sites',
  summary: '获取站点列表',
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
            results: z.array(siteSchema)
          })
        }
      },
      description: '站点列表'
    }
  }
})

departmentsRoutes.openapi(listSitesRoute, async (c) => {
  const { activeOnly, search } = c.req.valid('query')
  const service = c.get('services').masterData
  let results = await service.getSites()

  // 后端过滤
  if (activeOnly === 'true') {
    results = results.filter(r => r.active === 1)
  }
  if (search) {
    const s = search.toLowerCase()
    results = results.filter(r => r.name.toLowerCase().includes(s))
  }

  return c.json({ results })
})

const createSiteRoute = createRoute({
  method: 'post',
  path: '/sites',
  summary: '创建站点',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createSiteSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: siteSchema
        }
      },
      description: '创建成功'
    }
  }
})

departmentsRoutes.openapi(createSiteRoute, async (c) => {
  if (!hasPermission(c, 'site', 'info', 'create')) throw Errors.FORBIDDEN()
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  const result = await service.createSite({
    name: body.name,
    departmentId: body.departmentId
  })

  logAuditAction(c, 'create', 'site', result.id, JSON.stringify({ name: body.name, departmentId: body.departmentId }))

  return c.json({
    id: result.id,
    departmentId: result.departmentId,
    name: result.name,
    active: 1
  })
})

const updateSiteRoute = createRoute({
  method: 'put',
  path: '/sites/{id}',
  summary: '更新站点',
  request: {
    params: z.object({
      id: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: updateSiteSchema
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

departmentsRoutes.openapi(updateSiteRoute, async (c) => {
  if (!hasPermission(c, 'site', 'info', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const service = c.get('services').masterData

  await service.updateSite(id, {
    name: body.name,
    departmentId: body.departmentId,
    active: body.active ?? undefined
  })

  logAuditAction(c, 'update', 'site', id, JSON.stringify(body))
  return c.json({ ok: true })
})

const deleteSiteRoute = createRoute({
  method: 'delete',
  path: '/sites/{id}',
  summary: '删除站点',
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

departmentsRoutes.openapi(deleteSiteRoute, async (c) => {
  if (!hasPermission(c, 'site', 'info', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').masterData

  const result = await service.deleteSite(id)

  logAuditAction(c, 'delete', 'site', id, JSON.stringify({ name: result.name }))
  return c.json({ ok: true })
})
