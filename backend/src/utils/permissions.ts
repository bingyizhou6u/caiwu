import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { DataScope } from '../constants/permissions.js'

/**
 * PM 模块项目访问控制工具函数
 * 
 * 注意：大部分权限检查功能已迁移到新的权限系统：
 * - 权限检查：使用 createPermissionContext() from './permission-context.js'
 * - 数据过滤：使用 createDataAccessFilterSQL() from './data-access-filter.js'
 * 
 * 本文件仅保留 PM 模块特有的项目访问控制函数
 */

// 职位信息接口（内部使用）
interface Position {
  id: string
  code: string
  name: string
  canManageSubordinates: number
  dataScope: string
  permissions: any
}

// 员工信息接口（内部使用）
interface Employee {
  id: string
  email: string
  name: string
  positionId: string
  projectId: string | null
  orgDepartmentId: string | null
}

// 从Context获取用户职位信息（内部使用）
function getUserPosition(c: Context<{ Bindings: Env, Variables: AppVariables }>): Position | undefined {
  return c.get('userPosition') as Position | undefined
}

// 从Context获取用户员工信息（内部使用）
function getUserEmployee(c: Context<{ Bindings: Env, Variables: AppVariables }>): Employee | undefined {
  return c.get('userEmployee') as Employee | undefined
}

// ============================================
// PM 模块项目访问控制
// ============================================

/**
 * 验证用户是否可以访问指定项目的数据
 * 用于 PM 模块的 Data Scope 隔离
 * 支持多项目：检查 employee_projects 关联表
 * @param c Context
 * @param requestedProjectId 请求访问的项目ID
 * @returns 如果有权限返回 true，否则返回 false
 */
export async function validateProjectAccess(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  requestedProjectId: string | undefined
): Promise<boolean> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)

  if (!position || !employee) return false

  // dataScope = 'all': 总部用户可以访问所有项目
  if (position.dataScope === DataScope.ALL) {
    return true
  }

  // 如果没有请求的 projectId，无法验证
  if (!requestedProjectId) {
    return false
  }

  // 查询 employee_projects 关联表
  const association = await c.env.DB.prepare(
    'SELECT 1 FROM employee_projects WHERE employee_id = ? AND project_id = ? LIMIT 1'
  ).bind(employee.id, requestedProjectId).first()

  // 关联表中有记录则允许访问
  return !!association
}

/**
 * 获取用户可访问项目的列表
 * 用于列表查询时的隐式过滤
 * 支持多项目：从 employee_projects 关联表获取
 * @param c Context
 * @returns 项目ID数组，如果是 ALL scope 则返回 undefined 表示不限制
 */
export async function getAccessibleProjectIds(
  c: Context<{ Bindings: Env, Variables: AppVariables }>
): Promise<string[] | undefined> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)

  if (!position || !employee) return []

  // dataScope = 'all': 不限制
  if (position.dataScope === DataScope.ALL) {
    return undefined
  }

  // 从 employee_projects 表获取所有关联项目
  const rows = await c.env.DB.prepare(
    'SELECT project_id FROM employee_projects WHERE employee_id = ?'
  ).bind(employee.id).all<{ project_id: string }>()

  return rows.results?.map(r => r.project_id) || []
}
