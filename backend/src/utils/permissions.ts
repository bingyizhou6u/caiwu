import type { Env, AppVariables } from '../types.js'
import { getUserDepartmentIds, getUserOrgDepartmentId, isHQUser, getUserPosition, getUserGroupId } from './db.js'

// 基于职位的权限检查
export async function requirePosition(c: any, positionCodes: string[]): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false
  
  return positionCodes.includes(position.code)
}

// 检查是否有菜单权限（必须基于职位）
export async function canAccessMenu(c: any, menuKey: string, action: 'read' | 'write' | 'create' | 'delete' = 'read'): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false  // 必须有职位
  
  const perms = position.permissions?.menus || {}
  
  // 检查是否有全部权限
  if (perms['*'] && perms['*'].includes(action)) {
    return true
  }
  
  // 检查具体菜单权限
  if (perms[menuKey] && perms[menuKey].includes(action)) {
    return true
  }
  
  return false
}

// 检查是否可以查看报表（只有总部人员可以）
export async function canViewReports(c: any): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false  // 必须有职位
  
  // 检查职位权限中是否有reports权限
  if (position.permissions?.reports === true) {
    return true
  }
  
  // 总部负责人和总部财务部可以查看报表
  return position.code === 'hq_admin' || position.code === 'hq_finance'
}

// 检查是否可以访问操作（必须基于职位）
export async function canPerformAction(c: any, action: string): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false  // 必须有职位
  
  const actions = position.permissions?.actions || {}
  
  // 检查是否有全部权限
  if (actions['*'] === true) {
    return true
  }
  
  // 检查具体操作权限
  return actions[action] === true
}

// 向后兼容：基于role的权限检查（现在完全基于职位）
// manager角色有完整权限，可以访问所有功能
export async function requireRole(c: any, roles: string[]): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  // 获取用户职位
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false
  
  // 基于职位确定角色
  const { getRoleByPositionCode } = await import('./db.js')
  const role = getRoleByPositionCode(position.code)
  
  // manager角色有完整权限，可以访问所有功能
  if (role === 'manager') {
    return true
  }
  
  // 检查角色是否匹配
  return roles.includes(role)
}

export function requirePermission(c: any, permission: 'read' | 'write' | 'manage' | 'audit'): boolean {
  const role = c.get('userRole') as string | undefined
  if (!role) return false
  const PERMISSIONS: Record<string, string[]> = {
    manager: ['read', 'write', 'manage', 'audit'],
    finance: ['read', 'write', 'audit'],
    hr: ['read', 'write', 'audit'],
    auditor: ['read', 'audit'],
    employee: ['read']
  }
  const perms = PERMISSIONS[role] || []
  return perms.includes(permission)
}

// 异步版本的权限检查（确保userRole已设置）
export async function canReadAsync(c: any): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  // 检查是否有员工记录和职位
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) return false
  
  // 基于职位确定角色
  const { getRoleByPositionCode } = await import('./db.js')
  const role = getRoleByPositionCode(position.code)
  
  // 检查权限
  const PERMISSIONS: Record<string, string[]> = {
    manager: ['read', 'write', 'manage', 'audit'],
    finance: ['read', 'write', 'audit'],
    hr: ['read', 'write', 'audit'],
    auditor: ['read', 'audit'],
    employee: ['read']
  }
  const perms = PERMISSIONS[role] || []
  return perms.includes('read')
}

export function canRead(c: any) {
  return requirePermission(c, 'read')
}

export function canWrite(c: any) {
  return requirePermission(c, 'write')
}

// 检查是否是员工角色（只能查看自己的数据）
// 基于职位判断：如果职位level是employee或scope是self，则认为是员工
export async function isEmployee(c: any): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) {
    // 如果没有职位，回退到role检查（向后兼容）
    const role = c.get('userRole') as string | undefined
    return role === 'employee'
  }
  
  // 基于职位判断：职位level是employee或scope是self
  return position.level === 'employee' || position.scope === 'self'
}

// 检查是否是人事角色
// 基于职位判断：如果职位code包含hr，则认为是人事
export async function isHR(c: any): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (position && position.code.includes('hr')) {
    return true
  }
  
  // 向后兼容：如果没有职位或职位不匹配，回退到role检查
  const role = c.get('userRole') as string | undefined
  return role === 'hr'
}

// 检查是否是财务角色
// 基于职位判断：如果职位code包含finance，则认为是财务
export async function isFinance(c: any): Promise<boolean> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return false
  
  const position = await getUserPosition(c.env.DB, userId)
  if (position && position.code.includes('finance')) {
    return true
  }
  
  // 向后兼容：如果没有职位或职位不匹配，回退到role检查
  const role = c.get('userRole') as string | undefined
  return role === 'finance'
}

// 获取当前用户ID（用于员工角色数据过滤）
export function getCurrentUserId(c: any): string | undefined {
  return c.get('userId') as string | undefined
}

// 数据权限过滤：基于职位的数据范围限制（所有用户必须有职位）
export async function applyDataScope(c: any, sql: string, binds: any[]): Promise<{ sql: string, binds: any[] }> {
  const userId = c.get('userId') as string | undefined
  if (!userId) return { sql, binds }
  
  const position = await getUserPosition(c.env.DB, userId)
  if (!position) {
    // 如果没有职位，返回空结果（不应该发生）
    return { sql: `${sql} where 1=0`, binds }
  }
  
  // 总部负责人：可以查看所有数据
  if (position.scope === 'all') {
    return { sql, binds }
  }
  
  // 总部级别（总部+所有项目）：可以查看所有数据
  if (position.scope === 'hq_all') {
    return { sql, binds }
  }
  
  // 项目全部：只能查看本项目数据
  if (position.scope === 'project_all') {
    const deptIds = await getUserDepartmentIds(c.env.DB, userId)
    if (deptIds.length === 0) {
      return { sql, binds }
    }
    
    return addDepartmentFilter(sql, binds, deptIds)
  }
  
  // 项目部门：只能查看本部门数据
  if (position.scope === 'project_dept') {
    const orgDeptId = await getUserOrgDepartmentId(c.env.DB, userId)
    if (orgDeptId) {
      return addOrgDepartmentFilter(sql, binds, orgDeptId)
    }
    
    // 如果没有设置部门，回退到项目级别
    const deptIds = await getUserDepartmentIds(c.env.DB, userId)
    if (deptIds.length > 0) {
      return addDepartmentFilter(sql, binds, deptIds)
    }
  }
  
  // 部门级别：只能查看本部门数据
  if (position.scope === 'dept') {
    const orgDeptId = await getUserOrgDepartmentId(c.env.DB, userId)
    if (orgDeptId) {
      return addOrgDepartmentFilter(sql, binds, orgDeptId)
    }
  }
  
  // 组级别：只能查看组内数据
  if (position.scope === 'group') {
    const groupId = await getUserGroupId(c.env.DB, userId)
    if (groupId) {
      return addOrgDepartmentFilter(sql, binds, groupId)
    }
  }
  
  // 自己：数据范围限制在具体路由中处理
  if (position.scope === 'self') {
    return { sql, binds }
  }
  
  return { sql, binds }
}

// 辅助函数：添加项目过滤条件
function addDepartmentFilter(sql: string, binds: any[], deptIds: string[]): { sql: string, binds: any[] } {
  const sqlLower = sql.toLowerCase().trim()
  const hasWhere = sqlLower.includes('where')
  const hasGroupBy = sqlLower.includes('group by')
  const hasOrderBy = sqlLower.includes('order by')
  
  let insertPos = sql.length
  if (hasOrderBy) {
    insertPos = sql.toLowerCase().indexOf('order by')
  } else if (hasGroupBy) {
    insertPos = sql.toLowerCase().indexOf('group by')
  }
  
  const before = sql.slice(0, insertPos).trim()
  const after = sql.slice(insertPos).trim()
  
  const placeholders = deptIds.map(() => '?').join(',')
  let filterCondition = ''
  
  if (sqlLower.includes(' from employees e') || sqlLower.includes(' from employees ')) {
    filterCondition = `e.department_id in (${placeholders})`
  } else if (sqlLower.includes('department_id')) {
    filterCondition = `department_id in (${placeholders})`
  } else {
    return { sql, binds }
  }
  
  if (hasWhere) {
    sql = `${before} and ${filterCondition} ${after}`
  } else {
    sql = `${before} where ${filterCondition} ${after}`
  }
  binds.push(...deptIds)
  
  return { sql, binds }
}

// 辅助函数：添加组织部门过滤条件
function addOrgDepartmentFilter(sql: string, binds: any[], orgDeptId: string): { sql: string, binds: any[] } {
  const sqlLower = sql.toLowerCase().trim()
  const hasWhere = sqlLower.includes('where')
  const hasGroupBy = sqlLower.includes('group by')
  const hasOrderBy = sqlLower.includes('order by')
  
  let insertPos = sql.length
  if (hasOrderBy) {
    insertPos = sql.toLowerCase().indexOf('order by')
  } else if (hasGroupBy) {
    insertPos = sql.toLowerCase().indexOf('group by')
  }
  
  const before = sql.slice(0, insertPos).trim()
  const after = sql.slice(insertPos).trim()
  
  let filterCondition = ''
  if (sqlLower.includes(' from employees e') || sqlLower.includes(' from employees ')) {
    filterCondition = 'e.org_department_id = ?'
  } else if (sqlLower.includes('org_department_id')) {
    filterCondition = 'org_department_id = ?'
  } else {
    return { sql, binds }
  }
  
  if (hasWhere) {
    sql = `${before} and ${filterCondition} ${after}`
  } else {
    sql = `${before} where ${filterCondition} ${after}`
  }
  binds.push(orgDeptId)
  
  return { sql, binds }
}

