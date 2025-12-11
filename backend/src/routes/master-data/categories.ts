import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createCategorySchema, updateCategorySchema, categorySchema } from '../../schemas/master-data.schema.js'

export const categoriesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listCategoriesRoute = createRoute({
    method: 'get',
    path: '/',
    summary: '获取类别列表',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        results: z.array(categorySchema)
                    })
                }
            },
            description: '类别列表'
        }
    }
})

categoriesRoutes.openapi(listCategoriesRoute, async (c) => {
    const service = c.get('services').masterData
    const results = await service.getCategories()
    return c.json({ results })
})

const createCategoryRoute = createRoute({
    method: 'post',
    path: '/',
    summary: '创建类别',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createCategorySchema
                }
            }
        }
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: categorySchema
                }
            },
            description: '创建成功'
        }
    }
})

categoriesRoutes.openapi(createCategoryRoute, async (c) => {
    if (!hasPermission(c, 'system', 'category', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const service = c.get('services').masterData

    const result = await service.createCategory({
        name: body.name,
        kind: body.kind,
        parentId: body.parentId || undefined
    })

    logAuditAction(c, 'create', 'category', result.id, JSON.stringify({ name: body.name, kind: body.kind }))

    return c.json({
        id: result.id,
        name: result.name,
        kind: result.kind as any,
        parentId: result.parentId,
        active: 1
    })
})

const updateCategoryRoute = createRoute({
    method: 'put',
    path: '/{id}',
    summary: '更新类别',
    request: {
        params: z.object({
            id: z.string()
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateCategorySchema
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

categoriesRoutes.openapi(updateCategoryRoute, async (c) => {
    if (!hasPermission(c, 'system', 'category', 'update')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.get('services').masterData

    await service.updateCategory(id, {
        name: body.name,
        kind: body.kind
    })

    logAuditAction(c, 'update', 'category', id, JSON.stringify(body))
    return c.json({ ok: true })
})

const deleteCategoryRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    summary: '删除类别',
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

categoriesRoutes.openapi(deleteCategoryRoute, async (c) => {
    if (!hasPermission(c, 'system', 'category', 'delete')) throw Errors.FORBIDDEN()
    const id = c.req.param('id')
    const service = c.get('services').masterData

    const result = await service.deleteCategory(id)

    logAuditAction(c, 'delete', 'category', id, JSON.stringify({ name: result.name }))
    return c.json({ ok: true })
})
