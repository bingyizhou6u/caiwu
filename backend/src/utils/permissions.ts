import type { Context } from 'hono'
import type { Env, AppVariables } from '../types.js'

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
  function_role: 'director' | 'hr' | 'finance' | 'admin' | 'developer' | 'support' | 'member'
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
  c: Context<{ Bindings: Env, Variables: AppVariables }>,
  module: string,
  subModule: string,
  action: string
): boolean {
  const position = getUserPosition(c)
  if (!position || !position.permissions) return false

  // 1. 先检查部门是否允许访问该模块（总部人员跳过此检查）
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

  // 工程师只能查看自己
  if (position.code === 'team_engineer') {
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

  // 总部负责人/总部主管可以审批所有人
  if (position.code === 'hq_director' || position.code === 'hq_manager') {
    return true
  }

  // 项目主管可以审批本项目所有人
  if (position.code === 'project_manager') {
    const applicant = await c.env.DB.prepare(
      'SELECT department_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first()
    
    return applicant ? applicant.department_id === employee.department_id : false
  }

  // 组长只能审批本组工程师
  if (position.code === 'team_leader') {
    const applicant = await c.env.DB.prepare(
      'SELECT org_department_id, position_id FROM employees WHERE id = ?'
    ).bind(applicantEmployeeId).first()
    
    if (!applicant) return false
    
    // 必须是同一个组
    if (applicant.org_department_id !== employee.org_department_id) return false
    
    // 必须是工程师
    const applicantPosition = await c.env.DB.prepare(
      'SELECT code FROM positions WHERE id = ?'
    ).bind(applicant.position_id).first()
    
    return applicantPosition ? applicantPosition.code === 'team_engineer' : false
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

  // 工程师（team_engineer）：只能访问自己的数据
  if (position.code === 'team_engineer') {
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
