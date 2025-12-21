import type { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { sql, SQL } from 'drizzle-orm'

/**
 * 职位权限系统工具函数
 * 基于新的6职位模型（总部主管、总部专员、项目主管、项目专员、组长、工程师）
 */

// 职位信息接口
export interface Position {
  id: string
  code: string
  name: string
  level: number // 1-总部 2-项目 3-组
  canManageSubordinates: number
  permissions: any // JSON权限配置
}

// 员工信息接口
export interface Employee {
  id: string
  email: string
  name: string
  position_id: string
  departmentId: string | null // 项目ID
  orgDepartmentId: string | null // 组ID
}

// 从Context获取用户职位信息（由中间件预加载）
export function getUserPosition(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): Position | undefined {
  return c.get('userPosition') as Position | undefined
}

// 从Context获取用户员工信息（由中间件预加载）
export function getUserEmployee(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): Employee | undefined {
  return c.get('userEmployee') as Employee | undefined
}

// 从Context获取用户ID
export function getUserId(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): string | undefined {
  return c.get('userId') as string | undefined
}

// 从Context获取部门允许的模块列表
export function getDepartmentModules(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): string[] {
  return (c.get('departmentModules') as string[] | undefined) || ['*']
}

/**
 * 检查部门是否允许访问指定模块
 * @param c Hono Context
 * @param module 模块名（如 hr、finance、asset）
 * @returns 是否有访问权限
 */
export function hasDepartmentModuleAccess(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  module: string
): boolean {
  const position = getUserPosition(c)

  // 总部人员（level=1）不受部门模块限制
  if (position && position.level === 1) {
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
 * @param module 模块名：finance/hr/asset/report/system/self
 * @param subModule 子模块名：如finance.flow, hr.leave
 * @param action 操作：view/create/update/delete/approve/reject/export
 */
export function hasPermission(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  module: string,
  subModule: string,
  action: string
): boolean {
  const position = getUserPosition(c)
  if (!position || !position.permissions) { return false }

  // 1. 先检查部门是否允许访问该模块（总部人员跳过此检查）
  if (!hasDepartmentModuleAccess(c, module)) {
    return false
  }

  // 2. 再检查职位是否有该操作权限
  const modulePerms = position.permissions[module]
  if (!modulePerms) { return false }

  const subModulePerms = modulePerms[subModule]
  if (!subModulePerms) { return false }

  if (Array.isArray(subModulePerms)) {
    return subModulePerms.includes(action)
  }

  return false
}

/**
 * 检查是否可以管理下属（审批权限）
 */
export function canManageSubordinates(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): boolean {
  const position = getUserPosition(c)
  return position ? position.canManageSubordinates === 1 : false
}

/**
 * 检查是否是总部人员（level=1）
 */
export function isHeadquartersStaff(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 1 : false
}

/**
 * 检查是否是项目人员（level=2）
 */
export function isProjectStaff(c: Context<{ Bindings: Env; Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 2 : false
}

/**
 * 检查是否是组成员（level=3）
 */
export function isTeamMember(c: Context<{ Bindings: Env; Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 3 : false
}

/**
 * 检查是否有指定职位
 */
export function hasPositionCode(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  codes: string[]
): boolean {
  const position = getUserPosition(c)
  return position ? codes.includes(position.code) : false
}

/**
 * 获取用户完整权限配置
 * 直接返回职位的权限配置
 */
export function getUserPermissions(c: Context<{ Bindings: Env; Variables: AppVariables }>): any {
  const position = getUserPosition(c)
  if (!position || !position.permissions) { return {} }
  return position.permissions
}

// ============================================
// 数据访问控制辅助函数
// ============================================

/**
 * 获取数据访问范围过滤条件（返回 Drizzle SQL 对象，推荐使用）
 * 根据用户职位层级返回SQL过滤条件
 * @param c Context
 * @param tableAlias 表别名（如 e）
 * @param options 配置项
 * @returns Drizzle SQL 对象
 */
export function getDataAccessFilterSQL(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  tableAlias: string = '',
  options: {
    deptColumn?: string // 部门字段，默认 'departmentId'
    orgDeptColumn?: string // 组织/组字段，默认 'orgDepartmentId'
    ownerColumn?: string // 所有者字段，默认 'id' (用于工程师查看自己)
    skipOrgDept?: boolean // 是否跳过组级别过滤 (如果不分层级)
  } = {}
): SQL {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  const deptId = employee?.departmentId
  const orgDeptId = employee?.orgDepartmentId

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

  const deptCol = validateColumnName(options.deptColumn || 'departmentId')
  const orgDeptCol = validateColumnName(options.orgDeptColumn || 'orgDepartmentId')
  const ownerCol = validateColumnName(options.ownerColumn || 'id')

  // 构建表别名前缀（如果提供，也需要验证）
  const aliasPrefix = tableAlias ? `${validateColumnName(tableAlias)}.` : ''

  // 总部人员（level=1）：可以访问所有数据
  if (position.level === 1) {
    return sql`1=1`
  }

  // 项目人员（level=2）：只能访问本项目数据
  if (position.level === 2) {
    if (!deptId) {
      return sql`1=0`
    }
    // 使用 sql.raw() 插入列名（列名已通过白名单验证）
    // 使用 sql.raw() 插入列名（列名已通过白名单验证）
    return sql`${sql.raw(`${aliasPrefix}${deptCol}`)} = ${deptId}`
  }

  // 组长（team_leader）：只能访问本组数据
  if (position.code === 'team_leader') {
    if (options.skipOrgDept) {
      // 如果表没有组字段，回退到查看自己创建的
      return sql`${sql.raw(`${aliasPrefix}${ownerCol}`)} = ${employee.id}`
    }

    if (!orgDeptId) {
      return sql`${sql.raw(`${aliasPrefix}${ownerCol}`)} = ${employee.id}`
    }

    if (!orgDeptId) {
      return sql`1=0`
    }
    return sql`${sql.raw(`${aliasPrefix}${orgDeptCol}`)} = ${orgDeptId}`
  }

  // 工程师（team_engineer）或其他：只能访问自己的数据
  return sql`${sql.raw(`${aliasPrefix}${ownerCol}`)} = ${employee.id}`
}

/**
 * 获取当前用户ID
 */
export function getCurrentUserId(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): string | undefined {
  return getUserId(c)
}
