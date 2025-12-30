/**
 * Permission Context - 权限上下文类
 * 封装用户权限信息和常用权限检查方法
 */

import type { Context } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { DataScope, type DataScopeType } from '../constants/permissions.js'

/**
 * 职位信息接口
 */
export interface PositionInfo {
  id: string
  code: string
  name: string
  canManageSubordinates: number
  dataScope: DataScopeType
  permissions: Record<string, Record<string, string[]>>
}

/**
 * 员工信息接口
 */
export interface EmployeeInfo {
  id: string
  orgDepartmentId: string | null
  projectId: string | null
}

/**
 * Permission Context JSON 输出格式（供前端使用）
 */
export interface PermissionContextJSON {
  employeeId: string
  position: {
    id: string
    code: string
    name: string
  }
  permissions: Record<string, Record<string, string[]>>
  dataScope: DataScopeType
  canManageSubordinates: boolean
  allowedModules: string[]
  projectId: string | null
  orgDepartmentId: string | null
}

/**
 * 权限上下文类
 * 封装用户权限信息和常用权限检查方法
 */
export class PermissionContext {
  private readonly _employeeId: string
  private readonly _position: PositionInfo
  private readonly _employee: EmployeeInfo
  private readonly _departmentModules: string[]
  private readonly _db: D1Database

  constructor(
    employeeId: string,
    position: PositionInfo,
    employee: EmployeeInfo,
    departmentModules: string[],
    db: D1Database
  ) {
    this._employeeId = employeeId
    this._position = position
    this._employee = employee
    this._departmentModules = departmentModules
    this._db = db
  }

  /**
   * 获取员工ID
   */
  get employeeId(): string {
    return this._employeeId
  }

  /**
   * 获取数据范围
   */
  get dataScope(): DataScopeType {
    return this._position.dataScope
  }

  /**
   * 是否可以管理下属
   */
  get canManageSubordinates(): boolean {
    return this._position.canManageSubordinates === 1
  }

  /**
   * 获取部门允许的模块
   */
  get allowedModules(): string[] {
    return this._departmentModules
  }

  /**
   * 获取用户权限配置
   */
  get permissions(): Record<string, Record<string, string[]>> {
    return this._position.permissions
  }

  /**
   * 获取职位信息
   */
  get position(): PositionInfo {
    return this._position
  }

  /**
   * 获取员工信息
   */
  get employee(): EmployeeInfo {
    return this._employee
  }

  /**
   * 检查模块是否被部门允许
   * @param module 模块名（如 hr、finance、asset）
   */
  isModuleAllowed(module: string): boolean {
    // dataScope='all' (通常是总部) 不受部门模块限制
    if (this._position.dataScope === DataScope.ALL) {
      return true
    }

    // 如果包含 '*'，表示允许所有模块
    if (this._departmentModules.includes('*')) {
      return true
    }

    // 检查模块是否匹配（支持通配符，如 hr.* 匹配 hr.employee、hr.leave 等）
    return this._departmentModules.some(m => {
      if (m.endsWith('.*')) {
        const prefix = m.slice(0, -2)
        return module === prefix || module.startsWith(prefix + '.')
      }
      return m === module || module.startsWith(m + '.')
    })
  }

  /**
   * 检查是否具有指定权限
   * 权限计算：部门允许的模块 ∩ 职位定义的操作权限
   * @param module 模块名
   * @param subModule 子模块名（可选）
   * @param action 操作（可选）
   */
  hasPermission(module: string, subModule?: string, action?: string): boolean {
    // 1. 先检查部门是否允许访问该模块
    if (!this.isModuleAllowed(module)) {
      return false
    }

    // 2. 如果只检查模块级别
    if (!subModule) {
      return !!this._position.permissions[module]
    }

    // 3. 检查子模块
    const modulePerms = this._position.permissions[module]
    if (!modulePerms) return false

    const subModulePerms = modulePerms[subModule]
    if (!subModulePerms) return false

    // 4. 如果只检查子模块级别
    if (!action) {
      return Array.isArray(subModulePerms) && subModulePerms.length > 0
    }

    // 5. 检查具体操作
    if (Array.isArray(subModulePerms)) {
      return subModulePerms.includes(action)
    }

    return false
  }

  /**
   * 批量检查权限
   * @param requirements 权限要求数组
   * @param logic 组合逻辑，默认 'AND'
   */
  checkPermissions(
    requirements: Array<{ module: string; subModule?: string; action?: string }>,
    logic: 'AND' | 'OR' = 'AND'
  ): boolean {
    if (requirements.length === 0) return true

    if (logic === 'AND') {
      return requirements.every(req => 
        this.hasPermission(req.module, req.subModule, req.action)
      )
    } else {
      return requirements.some(req => 
        this.hasPermission(req.module, req.subModule, req.action)
      )
    }
  }

  /**
   * 批量检查权限并返回详细结果
   * 优化多权限检查场景的性能，一次性返回所有权限的检查结果
   * @param requirements 权限要求数组
   * @returns 每个权限的检查结果
   */
  checkPermissionsDetailed(
    requirements: Array<{ module: string; subModule?: string; action?: string }>
  ): Array<{ requirement: { module: string; subModule?: string; action?: string }; granted: boolean }> {
    return requirements.map(req => ({
      requirement: req,
      granted: this.hasPermission(req.module, req.subModule, req.action),
    }))
  }

  /**
   * 获取用户在指定模块下的所有权限
   * @param module 模块名
   * @returns 子模块和操作的映射
   */
  getModulePermissions(module: string): Record<string, string[]> | null {
    // 先检查部门是否允许访问该模块
    if (!this.isModuleAllowed(module)) {
      return null
    }

    return this._position.permissions[module] || null
  }

  /**
   * 获取用户所有有效权限（考虑部门模块限制）
   * @returns 过滤后的权限配置
   */
  getEffectivePermissions(): Record<string, Record<string, string[]>> {
    const result: Record<string, Record<string, string[]>> = {}

    for (const module of Object.keys(this._position.permissions)) {
      if (this.isModuleAllowed(module)) {
        result[module] = this._position.permissions[module]
      }
    }

    return result
  }

  /**
   * 检查是否可以访问指定员工的数据
   * @param targetEmployeeId 目标员工ID
   */
  async canAccessData(targetEmployeeId: string): Promise<boolean> {
    // Scope: ALL - 可以访问所有数据
    if (this._position.dataScope === DataScope.ALL) {
      return true
    }

    // 自己的数据总是可以访问
    if (targetEmployeeId === this._employee.id) {
      return true
    }

    // Scope: PROJECT - 同项目可访问
    if (this._position.dataScope === DataScope.PROJECT) {
      if (!this._employee.projectId) return false
      
      const target = await this._db.prepare(
        'SELECT project_id FROM employees WHERE id = ?'
      ).bind(targetEmployeeId).first<{ project_id: string }>()

      return target ? target.project_id === this._employee.projectId : false
    }

    // Scope: GROUP - 同组可访问
    if (this._position.dataScope === DataScope.GROUP) {
      if (!this._employee.orgDepartmentId) return false
      
      const target = await this._db.prepare(
        'SELECT org_department_id FROM employees WHERE id = ?'
      ).bind(targetEmployeeId).first<{ org_department_id: string }>()

      return target ? target.org_department_id === this._employee.orgDepartmentId : false
    }

    // Scope: SELF - 只能访问自己的数据
    return false
  }

  /**
   * 检查是否可以审批指定员工的申请
   * @param applicantEmployeeId 申请人员工ID
   */
  async canApprove(applicantEmployeeId: string): Promise<boolean> {
    // 必须有管理下属权限
    if (!this.canManageSubordinates) return false

    // 不能审批自己的申请
    if (applicantEmployeeId === this._employee.id) return false

    // Scope: ALL - 可以审批所有人
    if (this._position.dataScope === DataScope.ALL) {
      return true
    }

    // Scope: PROJECT - 同项目可审批
    if (this._position.dataScope === DataScope.PROJECT) {
      if (!this._employee.projectId) return false
      
      const applicant = await this._db.prepare(
        'SELECT project_id FROM employees WHERE id = ?'
      ).bind(applicantEmployeeId).first<{ project_id: string }>()

      return applicant ? applicant.project_id === this._employee.projectId : false
    }

    // Scope: GROUP - 同组可审批
    if (this._position.dataScope === DataScope.GROUP) {
      if (!this._employee.orgDepartmentId) return false
      
      const applicant = await this._db.prepare(
        'SELECT org_department_id FROM employees WHERE id = ?'
      ).bind(applicantEmployeeId).first<{ org_department_id: string }>()

      return applicant ? applicant.org_department_id === this._employee.orgDepartmentId : false
    }

    // Scope: SELF - 不能审批任何人
    return false
  }

  /**
   * 导出为 JSON（用于前端）
   */
  toJSON(): PermissionContextJSON {
    return {
      employeeId: this._employeeId,
      position: {
        id: this._position.id,
        code: this._position.code,
        name: this._position.name,
      },
      permissions: this._position.permissions,
      dataScope: this._position.dataScope,
      canManageSubordinates: this.canManageSubordinates,
      allowedModules: this._departmentModules,
      projectId: this._employee.projectId,
      orgDepartmentId: this._employee.orgDepartmentId,
    }
  }
}

/**
 * 从请求上下文创建 PermissionContext
 * @param c Hono Context
 * @returns PermissionContext 实例，如果用户未认证则返回 null
 */
export function createPermissionContext(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): PermissionContext | null {
  const employeeId = c.get('employeeId')
  const userPosition = c.get('userPosition')
  const userEmployee = c.get('userEmployee')
  const departmentModules = c.get('departmentModules') || ['*']

  if (!employeeId || !userPosition || !userEmployee) {
    return null
  }

  const position: PositionInfo = {
    id: userPosition.id,
    code: userPosition.code,
    name: userPosition.name,
    canManageSubordinates: userPosition.canManageSubordinates,
    dataScope: (userPosition.dataScope as DataScopeType) || 'self',
    permissions: userPosition.permissions || {},
  }

  const employee: EmployeeInfo = {
    id: userEmployee.id,
    orgDepartmentId: userEmployee.orgDepartmentId,
    projectId: userEmployee.projectId,
  }

  return new PermissionContext(
    employeeId,
    position,
    employee,
    departmentModules,
    c.env.DB
  )
}

/**
 * 从原始数据创建 PermissionContext（用于测试或直接构造）
 */
export function createPermissionContextFromData(
  employeeId: string,
  position: PositionInfo,
  employee: EmployeeInfo,
  departmentModules: string[],
  db: D1Database
): PermissionContext {
  return new PermissionContext(employeeId, position, employee, departmentModules, db)
}
