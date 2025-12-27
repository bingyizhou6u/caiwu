import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { sql, SQL } from 'drizzle-orm'
import { DataScope, DataScopeType, PermissionModuleType, PermissionActionType } from '../constants/permissions.js'

/**
 * 职位权限系统工具函数
 * 已重构为基于 data_scope 的能力判断，解耦了具体的职位代码
 */

// 职位信息接口
export interface Position {
  id: string
  code: string
  name: string
  canManageSubordinates: number
  dataScope: DataScopeType // 数据访问范围
  permissions: any // JSON权限配置
}

// 员工信息接口
export interface Employee {
  id: string
  email: string
  name: string
  positionId: string
  projectId: string | null // 项目ID
  orgProjectId: string | null // 组ID
}

// 从Context获取用户职位信息（由中间件预加载）
export function getUserPosition(c: Context<{ Bindings: Env, Variables: AppVariables }>): Position | undefined {
  return c.get('userPosition') as Position | undefined
}

// 从Context获取用户员工信息（由中间件预加载）
export function getUserEmployee(c: Context<{ Bindings: Env, Variables: AppVariables }>): Employee | undefined {
  return c.get('userEmployee') as Employee | undefined
}

// 从Context获取用户ID
export function getUserId(c: Context<{ Bindings: Env, Variables: AppVariables }>): string | undefined {
  return c.get('employeeId') as string | undefined
}

// 从Context获取部门允许的模块列表
export function getDepartmentModules(c: Context<{ Bindings: Env, Variables: AppVariables }>): string[] {
  return (c.get('departmentModules') as string[] | undefined) || ['*']
}

/**
 * 检查部门是否允许访问指定模块
 * @param c Hono Context
 * @param module 模块名（如 hr、finance、asset）
 * @returns 是否有访问权限
 */
export function hasDepartmentModuleAccess(c: Context<{ Bindings: Env, Variables: AppVariables }>, module: string): boolean {
  const position = getUserPosition(c)

  // dataScope='all' (通常是总部) 不受部门模块限制
  if (position && position.dataScope === DataScope.ALL) {
    return true
  }

  const deptModules = getDepartmentModules(c)

  // 如果包含 '*'，表示允许所有模块
  if (deptModules.includes('*')) {
    return true
  }

  // 检查模块是否匹配（支持通配符，如 hr.* 匹配 hr.employee、hr.leave 等）
  return deptModules.some(m => {
    if (m.endsWith('.*')) {
      const prefix = m.slice(0, -2)
      return module === prefix || module.startsWith(prefix + '.')
    }
    return m === module || module.startsWith(m + '.')
  })
}

/**
 * 检查是否有指定模块的权限
 * 权限计算：部门允许的模块 ∩ 职位定义的操作权限
 * @param c Hono Context
 * @param module 模块名
 * @param subModule 子模块名
 * @param action 操作
 */
export function hasPermission(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  module: string,
  subModule: string,
  action: string
): boolean {
  const position = getUserPosition(c)
  if (!position || !position.permissions) return false

  // 1. 先检查部门是否允许访问该模块
  if (!hasDepartmentModuleAccess(c, module)) {
    return false
  }

  // 2. 再检查职位是否有该操作权限
  const modulePerms = position.permissions[module]
  if (!modulePerms) return false

  const subModulePerms = modulePerms[subModule]
  if (!subModulePerms) return false

  if (Array.isArray(subModulePerms)) {
    return subModulePerms.includes(action)
  }

  return false
}

/**
 * 检查是否可以管理下属（审批权限）
 */
export function canManageSubordinates(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.canManageSubordinates === 1 : false
}


/**
 * 检查是否为普通团队成员 (Scope = SELF)
 */
export function isTeamMember(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.dataScope === DataScope.SELF : false
}

/**
 * 检查是否可以查看指定员工的数据
 * 基于 dataScope 判断
 * @param c Context
 * @param targetEmployeeId 目标员工ID
 * @param options 配置项
 */
export async function canViewEmployee(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  targetEmployeeId: string
): Promise<boolean> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  if (!position || !employee) return false

  // Scope: ALL
  if (position.dataScope === DataScope.ALL) {
    return true
  }

  // Scope: PROJECT (Same Department)
  if (position.dataScope === DataScope.PROJECT) {
    const target = await c.env.DB.prepare(
      'SELECT project_id FROM employees WHERE id = ?'
    ).bind(targetEmployeeId).first<{ project_id: string }>()

    return target ? target.project_id === employee.projectId : false
  }

  // Scope: GROUP (Same Org Department)
  if (position.dataScope === DataScope.GROUP) {
    const target = await c.env.DB.prepare(
      'SELECT org_project_id FROM employees WHERE id = ?'
    ).bind(targetEmployeeId).first<{ org_project_id: string }>()

    return target ? target.org_project_id === employee.orgProjectId : false
  }

  // Scope: SELF
  if (position.dataScope === DataScope.SELF) {
    return targetEmployeeId === employee.id
  }

  return false
}

/**
 * 检查是否可以审批指定员工的申请（请假/报销）
 * 基于 dataScope 和 canManageSubordinates 判断
 * @param c Context
 * @param applicantEmployeeId 申请人员工ID
 */
export async function canApproveApplication(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  applicantEmployeeId: string
): Promise<boolean> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  if (!position || !employee) return false

  // 必须有管理下属权限
  if (position.canManageSubordinates !== 1) return false

  // Scope: ALL
  if (position.dataScope === DataScope.ALL) {
    return true
  }

  // Scope: PROJECT
  if (position.dataScope === DataScope.PROJECT) {
    const applicant = await c.env.DB.prepare(
      'SELECT project_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first<{ project_id: string }>()

    return applicant ? applicant.project_id === employee.projectId : false
  }

  // Scope: GROUP
  if (position.dataScope === DataScope.GROUP) {
    const applicant = await c.env.DB.prepare(
      'SELECT org_project_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first<{ org_project_id: string }>()

    return applicant ? applicant.org_project_id === employee.orgProjectId : false
  }

  return false
}

/**
 * 获取用户完整权限配置
 * 直接返回职位的权限配置
 */
export function getUserPermissions(c: Context<{ Bindings: Env, Variables: AppVariables }>): any {
  const position = getUserPosition(c)
  if (!position || !position.permissions) return {}
  return position.permissions
}

// ============================================
// 数据访问控制辅助函数
// ============================================

/**
 * 获取数据访问范围过滤条件（返回 Drizzle SQL 对象，推荐使用）
 * 根据用户职位 dataScope 返回SQL过滤条件
 * @param c Context
 * @param tableAlias 表别名（如 e）
 * @param options 配置项
 * @returns Drizzle SQL 对象
 */
export function getDataAccessFilterSQL(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  tableAlias: string = '',
  options: {
    deptColumn?: string // 部门字段，默认 'projectId'
    orgDeptColumn?: string // 组织/组字段，默认 'orgProjectId'
    ownerColumn?: string // 所有者字段，默认 'id'
    skipOrgDept?: boolean // 是否跳过组织部门检查（用于没有 orgDept 字段的表）
  } = {}
): SQL {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)

  if (!position || !employee) {
    return sql`1=0`
  }

  // 列名白名单验证（确保列名只包含字母、数字和下划线，防止SQL注入）
  const validateColumnName = (name: string): string => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid column name: ${name}`)
    }
    return name
  }

  const deptCol = validateColumnName(options.deptColumn || 'projectId')
  const orgDeptCol = validateColumnName(options.orgDeptColumn || 'orgProjectId')
  const ownerCol = validateColumnName(options.ownerColumn || 'id')

  // 构建表别名前缀（如果提供，也需要验证）
  const aliasPrefix = tableAlias ? `${validateColumnName(tableAlias)}.` : ''

  switch (position.dataScope) {
    case DataScope.ALL:
      return sql`1=1`

    case DataScope.PROJECT:
      if (!employee.projectId) return sql`1=0`
      return sql`${sql.raw(`${aliasPrefix}${deptCol}`)} = ${employee.projectId}`

    case DataScope.GROUP:
      if (options.skipOrgDept) {
        // 如果表没有 orgDept 字段，且用户范围是 GROUP，则降级为 SELF
        return sql`${sql.raw(`${aliasPrefix}${ownerCol}`)} = ${employee.id}`
      }
      if (!employee.orgProjectId) return sql`1=0`
      return sql`${sql.raw(`${aliasPrefix}${orgDeptCol}`)} = ${employee.orgProjectId}`

    case DataScope.SELF:
    default:
      return sql`${sql.raw(`${aliasPrefix}${ownerCol}`)} = ${employee.id}`
  }
}

/**
 * 获取当前用户ID
 */
export function getCurrentUserId(
  c: Context<{ Bindings: Env, Variables: AppVariables }>
): string | undefined {
  return getUserId(c)
}
