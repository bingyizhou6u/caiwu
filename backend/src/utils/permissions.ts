import type { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'

/**
 * 职位权限系统工具函数
 * 基于"职能角色 + 组织层级"交叉组合的10职位模型
 */

// 职位信息接口
export interface Position {
  id: string
  code: string
  name: string
  level: number // 1-总部 2-项目 3-组
  function_role: 'director' | 'hr' | 'finance' | 'admin' | 'developer'
  can_manage_subordinates: number
  permissions: any // JSON权限配置
}

// 员工信息接口
export interface Employee {
  id: string
  email: string
  name: string
  position_id: string
  department_id: string | null // 项目ID
  org_department_id: string | null // 组ID
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
  return c.get('userId') as string | undefined
}

/**
 * 检查是否有指定模块的权限
 * @param c Hono Context
 * @param module 模块名：finance/hr/asset/report/system/self
 * @param subModule 子模块名：如finance.flow, hr.leave
 * @param action 操作：view/create/update/delete/approve/reject/export
 */
export function hasPermission(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  module: string,
  subModule: string,
  action: string
): boolean {
  const position = getUserPosition(c)
  if (!position || !position.permissions) return false

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
  return position ? position.can_manage_subordinates === 1 : false
}

/**
 * 检查是否是总部人员（level=1）
 */
export function isHeadquartersStaff(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 1 : false
}

/**
 * 检查是否是项目人员（level=2）
 */
export function isProjectStaff(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 2 : false
}

/**
 * 检查是否是组成员（level=3）
 */
export function isTeamMember(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level === 3 : false
}

/**
 * 检查是否有指定职位
 */
export function hasPositionCode(c: Context<{ Bindings: Env, Variables: AppVariables }>, codes: string[]): boolean {
  const position = getUserPosition(c)
  return position ? codes.includes(position.code) : false
}

/**
 * 检查是否是总部负责人
 */
export function isHQDirector(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['hq_director'])
}

/**
 * 检查是否是总部财务
 */
export function isHQFinance(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['hq_finance'])
}

/**
 * 检查是否是总部人事
 */
export function isHQHR(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['hq_hr'])
}

/**
 * 检查是否是总部行政
 */
export function isHQAdmin(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['hq_admin'])
}

/**
 * 检查是否是项目负责人
 */
export function isProjectDirector(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['project_director'])
}

/**
 * 检查是否是项目人事
 */
export function isProjectHR(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['project_hr'])
}

/**
 * 检查是否是项目财务
 */
export function isProjectFinance(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['project_finance'])
}

/**
 * 检查是否是项目行政
 */
export function isProjectAdmin(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['project_admin'])
}

/**
 * 检查是否是组长
 */
export function isTeamLeader(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['team_leader'])
}

/**
 * 检查是否是组员（开发）
 */
export function isTeamDeveloper(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  return hasPositionCode(c, ['team_developer'])
}

/**
 * 检查是否具有指定职能角色
 */
export function hasFunctionRole(c: Context<{ Bindings: Env, Variables: AppVariables }>, role: string): boolean {
  const position = getUserPosition(c)
  return position ? position.function_role === role : false
}

/**
 * 检查是否可以查看指定员工的数据
 * @param c Context
 * @param targetEmployeeId 目标员工ID
 */
export async function canViewEmployee(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  targetEmployeeId: string
): Promise<boolean> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  if (!position || !employee) return false

  // 总部人员可以查看所有人
  if (position.level === 1) {
    return true
  }

  // 项目级别：可以查看本项目所有人
  if (position.level === 2) {
    const target = await c.env.DB.prepare(
      'SELECT department_id FROM employees WHERE id = ?'
    ).bind(targetEmployeeId).first()
    
    return target ? target.department_id === employee.department_id : false
  }

  // 组长可以查看本组所有人
  if (position.code === 'team_leader') {
    const target = await c.env.DB.prepare(
      'SELECT org_department_id FROM employees WHERE id = ?'
    ).bind(targetEmployeeId).first()
    
    return target ? target.org_department_id === employee.org_department_id : false
  }

  // 组员只能查看自己
  if (position.code === 'team_developer') {
    return targetEmployeeId === employee.id
  }

  return false
}

/**
 * 检查是否可以审批指定员工的申请（请假/报销）
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
  if (position.can_manage_subordinates !== 1) return false

  // 总部负责人、总部人事、总部财务可以审批所有人
  if (['hq_director', 'hq_hr', 'hq_finance'].includes(position.code)) {
    return true
  }

  // 项目负责人、项目人事可以审批本项目所有人
  if (['project_director', 'project_hr'].includes(position.code)) {
    const applicant = await c.env.DB.prepare(
      'SELECT department_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first()
    
    return applicant ? applicant.department_id === employee.department_id : false
  }

  // 组长只能审批本组开发人员（team_developer）
  if (position.code === 'team_leader') {
    const applicant = await c.env.DB.prepare(
      'SELECT org_department_id, position_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first()
    
    if (!applicant) return false
    
    // 必须是同一个组
    if (applicant.org_department_id !== employee.org_department_id) return false
    
    // 必须是组员（team_developer）
    const applicantPosition = await c.env.DB.prepare(
      'SELECT code FROM positions WHERE id = ?'
    ).bind(applicant.position_id).first()
    
    return applicantPosition ? applicantPosition.code === 'team_developer' : false
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
 * 获取数据访问范围过滤条件
 * 根据用户职位层级返回SQL过滤条件
 * @param c Context
 * @param tableAlias 表别名（如 e）
 * @returns SQL过滤条件和绑定参数
 */
export function getDataAccessFilter(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  tableAlias: string = 'e'
): { where: string, binds: any[] } {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  
  if (!position || !employee) {
    return { where: '1=0', binds: [] }
  }

  const alias = tableAlias ? `${tableAlias}.` : ''

  // 总部人员（level=1）：可以访问所有数据
  if (position.level === 1) {
    return { where: '1=1', binds: [] }
  }

  // 项目人员（level=2）：只能访问本项目数据
  if (position.level === 2) {
    if (!employee.department_id) {
      return { where: '1=0', binds: [] }
    }
    return {
      where: `${alias}department_id = ?`,
      binds: [employee.department_id]
    }
  }

  // 组长（team_leader）：只能访问本组数据
  if (position.code === 'team_leader') {
    if (!employee.org_department_id) {
      return { where: '1=0', binds: [] }
    }
    return {
      where: `${alias}org_department_id = ?`,
      binds: [employee.org_department_id]
    }
  }

  // 组员（team_developer）：只能访问自己的数据
  if (position.code === 'team_developer') {
    return {
      where: `${alias}id = ?`,
      binds: [employee.id]
    }
  }

  return { where: '1=0', binds: [] }
}

/**
 * 获取当前用户ID
 */
export function getCurrentUserId(c: Context<{ Bindings: Env, Variables: AppVariables }>): string | undefined {
  return getUserId(c)
}

// ============================================
// 临时兼容函数 - 用于支持旧代码逐步迁移
// 这些函数将在所有路由重构完成后删除
// ============================================

/**
 * @deprecated 临时兼容函数,使用hasPermission替代
 */
export async function requireRole(c: Context<{ Bindings: Env, Variables: AppVariables }>, roles: string[]): Promise<boolean> {
  const position = getUserPosition(c)
  if (!position) return false
  
  // 映射旧角色到新职位
  if (roles.includes('manager')) {
    if (['hq_director', 'project_director', 'team_leader'].includes(position.code)) return true
  }
  if (roles.includes('finance')) {
    if (['hq_finance', 'project_finance'].includes(position.code)) return true
  }
  if (roles.includes('hr')) {
    if (['hq_hr', 'project_hr'].includes(position.code)) return true
  }
  if (roles.includes('admin')) {
    if (['hq_admin', 'project_admin'].includes(position.code)) return true
  }
  if (roles.includes('auditor')) {
    // 总部负责人具有审计权限
    if (position.code === 'hq_director') return true
  }
  return false
}

/**
 * @deprecated 临时兼容函数
 */
export function requirePermission(c: Context<{ Bindings: Env, Variables: AppVariables }>, permission: string): boolean {
  return true // 临时允许所有操作
}

/**
 * @deprecated 临时兼容函数
 */
export function canRead(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position !== undefined
}

/**
 * @deprecated 临时兼容函数
 */
export async function canReadAsync(c: Context<{ Bindings: Env, Variables: AppVariables }>): Promise<boolean> {
  return canRead(c)
}

/**
 * @deprecated 临时兼容函数
 */
export function canWrite(c: Context<{ Bindings: Env, Variables: AppVariables }>): boolean {
  const position = getUserPosition(c)
  return position ? position.level <= 2 : false
}

/**
 * @deprecated 临时兼容函数,使用isTeamDeveloper替代
 */
export async function isEmployee(c: Context<{ Bindings: Env, Variables: AppVariables }>): Promise<boolean> {
  return isTeamDeveloper(c)
}

/**
 * @deprecated 临时兼容函数,使用hasPositionCode替代
 */
export async function isHR(c: Context<{ Bindings: Env, Variables: AppVariables }>): Promise<boolean> {
  return hasPositionCode(c, ['hq_hr', 'project_hr'])
}

/**
 * @deprecated 临时兼容函数,使用hasPositionCode替代
 */
export async function isFinance(c: Context<{ Bindings: Env, Variables: AppVariables }>): Promise<boolean> {
  return hasPositionCode(c, ['hq_finance', 'project_finance'])
}

/**
 * @deprecated 临时兼容函数
 */
export async function canViewReports(c: Context<{ Bindings: Env, Variables: AppVariables }>): Promise<boolean> {
  const position = getUserPosition(c)
  return position ? position.level <= 2 : false
}

/**
 * @deprecated 临时兼容函数,使用getDataAccessFilter替代
 */
export async function applyDataScope(
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  sql: string,
  binds: any[]
): Promise<{ sql: string, binds: any[] }> {
  const position = getUserPosition(c)
  const employee = getUserEmployee(c)
  
  if (!position || !employee) {
    return { sql: `${sql} WHERE 1=0`, binds }
  }

  // 总部人员(level=1):可以访问所有数据
  if (position.level === 1) {
    return { sql, binds }
  }

  // 项目人员(level=2):只能访问本项目数据
  if (position.level === 2) {
    if (!employee.department_id) {
      return { sql: `${sql} WHERE 1=0`, binds }
    }
    const sqlLower = sql.toLowerCase()
    const hasWhere = sqlLower.includes('where')
    const connector = hasWhere ? ' AND' : ' WHERE'
    if (sqlLower.includes('department_id')) {
      return { sql: `${sql}${connector} department_id = ?`, binds: [...binds, employee.department_id] }
    }
    return { sql, binds }
  }

  // 组员(team_developer):只能访问自己的数据
  if (position.code === 'team_developer') {
    const sqlLower = sql.toLowerCase()
    const hasWhere = sqlLower.includes('where')
    const connector = hasWhere ? ' AND' : ' WHERE'
    return { sql: `${sql}${connector} employee_id = ?`, binds: [...binds, employee.id] }
  }

  return { sql, binds }
}
