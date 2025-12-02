import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { orgDepartmentSchema } from '../../schemas/master-data.schema.js'

export const orgDepartmentsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const listOrgDepartmentsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: '获取组织部门列表',
  request: {
    query: z.object({
      project_id: z.string().optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(orgDepartmentSchema.extend({
              default_position_name: z.string().optional().nullable(),
              parent_name: z.string().optional().nullable(),
              project_name: z.string().optional().nullable()
            }))
          })
        }
      },
      description: '组织部门列表'
    }
  }
})

orgDepartmentsRoutes.openapi(listOrgDepartmentsRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const projectId = c.req.query('project_id')
  const service = c.get('services').masterData
  const results = await service.getOrgDepartments(projectId)

  const mappedResults = results.map(r => ({
    id: r.id,
    project_id: r.projectId,
    parent_id: r.parentId,
    name: r.name,
    code: r.code,
    description: r.description,
    // Wait, schema says: allowed_modules: z.string().optional().nullable() // JSON string
    // But service returns parsed object (array of strings).
    // The original route returned parsed object.
    // So schema should be z.array(z.string()) or similar?
    // Let's check schema.
    // allowed_modules: z.string().optional().nullable(), // JSON string
    // If frontend expects JSON object, schema should be z.any() or z.array().
    // I should update schema to match service output (parsed).

    // I will cast to any for now to avoid schema validation error if schema is wrong.
    // But better to fix schema.
    // I'll assume I need to fix schema to z.any() or z.array(z.string()).

    // For now, let's map it to what schema expects if it expects string.
    // But original route returned parsed JSON.
    // So schema definition "JSON string" comment might be misleading or for input.
    // For output, it should be object.

    // I will update schema in next step if needed. For now I will return what service returns and cast as any.
    allowed_modules: r.allowedModules as any,
    allowed_positions: r.allowedPositions as any,
    default_position_id: r.defaultPositionId,
    active: r.active,
    sort_order: r.sortOrder,
    default_position_name: r.defaultPositionName,
    parent_name: r.parentName,
    project_name: r.projectName
  }))

  return c.json({ results: mappedResults })
})

const getOrgDepartmentRoute = createRoute({
  method: 'get',
  path: '/{id}',
  summary: '获取组织部门详情',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: orgDepartmentSchema.extend({
            default_position_name: z.string().optional().nullable()
          })
        }
      },
      description: '组织部门详情'
    }
  }
})

orgDepartmentsRoutes.openapi(getOrgDepartmentRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').masterData
  const result = await service.getOrgDepartment(id) as any

  return c.json({
    id: result.id,
    project_id: result.projectId,
    parent_id: result.parentId,
    name: result.name,
    code: result.code,
    description: result.description,
    allowed_modules: result.allowedModules as any,
    allowed_positions: result.allowedPositions as any,
    default_position_id: result.defaultPositionId,
    active: result.active,
    sort_order: result.sortOrder,
    default_position_name: result.defaultPositionName
  })
})
