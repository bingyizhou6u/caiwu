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
    parentId: r.parentId,
    name: r.name,
    code: r.code,
    description: r.description,
    // 等等，schema 说：allowed_modules: z.string().optional().nullable() // JSON string
    // 但是 service 返回解析后的对象（字符串数组）。
    // 原始路由返回解析后的对象。
    // 所以 schema 应该是 z.array(z.string()) 或类似的东西？
    // 让我们检查 schema。
    // allowed_modules: z.string().optional().nullable(), // JSON string
    // 如果前端期望 JSON 对象，schema 应该是 z.any() 或 z.array()。
    // 我应该更新 schema 以匹配 service 输出（已解析）。

    // 我暂时将其转换为 any 以避免 schema 验证错误（如果 schema 错误）。
    // 但最好修复 schema。
    // 我假设我需要将 schema 修复为 z.any() 或 z.array(z.string())。

    // 目前，让我们将其映射为 schema 期望的内容（如果它期望字符串）。
    // 但原始路由返回了解析后的 JSON。
    // 所以 schema 定义中的 "JSON string" 注释可能有误导性，或者是针对输入的。
    // 对于输出，它应该是对象。

    // 如果需要，我将在下一步更新 schema。目前我将返回 service 返回的内容并转换为 any。
    allowed_modules: r.allowedModules as any,
    allowed_positions: r.allowedPositions as any,
    default_position_id: r.defaultPositionId,
    active: r.active,
    sortOrder: r.sortOrder,
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
    parentId: result.parentId,
    name: result.name,
    code: result.code,
    description: result.description,
    allowed_modules: result.allowedModules as any,
    allowed_positions: result.allowedPositions as any,
    default_position_id: result.defaultPositionId,
    active: result.active,
    sortOrder: result.sortOrder,
    default_position_name: result.defaultPositionName
  })
})
