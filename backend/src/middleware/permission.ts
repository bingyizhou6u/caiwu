import { createMiddleware } from 'hono/factory'
import type { Env, AppVariables } from '../types/index.js'
import { createPermissionContext } from '../utils/permission-context.js'
import { Errors, createError } from '../utils/errors.js'
import { ErrorCodes } from '../constants/errorCodes.js'

/**
 * 权限要求配置
 */
export interface PermissionRequirement {
  /** 模块名 (e.g., 'finance', 'hr') */
  module: string
  /** 子模块名 (e.g., 'flow', 'employee') */
  subModule?: string
  /** 操作 (e.g., 'view', 'create', 'update', 'delete') */
  action?: string
}

/**
 * 权限守卫配置
 */
export interface PermissionGuardConfig {
  /** 所需权限（单个或多个） */
  permissions: PermissionRequirement | PermissionRequirement[]
  /** 多个权限的组合逻辑，默认 'AND' */
  logic?: 'AND' | 'OR'
  /** 是否跳过权限检查 */
  skip?: boolean
  /** 自定义错误消息 */
  errorMessage?: string
}

/**
 * 检查用户是否具有指定权限
 * @param userPermissions 用户权限配置
 * @param departmentModules 部门允许的模块
 * @param dataScope 数据范围
 * @param requirement 权限要求
 */
export function checkPermission(
  userPermissions: Record<string, Record<string, string[]>>,
  departmentModules: string[],
  dataScope: string,
  requirement: PermissionRequirement
): boolean {
  const { module, subModule, action } = requirement

  // 1. 先检查部门是否允许访问该模块
  if (!isModuleAllowed(departmentModules, dataScope, module)) {
    return false
  }

  // 2. 如果只检查模块级别
  if (!subModule) {
    return !!userPermissions[module]
  }

  // 3. 检查子模块
  const modulePerms = userPermissions[module]
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
 * 检查模块是否被部门允许
 */
function isModuleAllowed(departmentModules: string[], dataScope: string, module: string): boolean {
  // dataScope='all' (通常是总部) 不受部门模块限制
  if (dataScope === 'all') {
    return true
  }

  // 如果包含 '*'，表示允许所有模块
  if (departmentModules.includes('*')) {
    return true
  }

  // 检查模块是否匹配（支持通配符，如 hr.* 匹配 hr.employee、hr.leave 等）
  return departmentModules.some(m => {
    if (m.endsWith('.*')) {
      const prefix = m.slice(0, -2)
      return module === prefix || module.startsWith(prefix + '.')
    }
    return m === module || module.startsWith(m + '.')
  })
}

/**
 * 批量检查权限
 * @param userPermissions 用户权限配置
 * @param departmentModules 部门允许的模块
 * @param dataScope 数据范围
 * @param requirements 权限要求数组
 * @param logic 组合逻辑
 */
export function checkPermissions(
  userPermissions: Record<string, Record<string, string[]>>,
  departmentModules: string[],
  dataScope: string,
  requirements: PermissionRequirement[],
  logic: 'AND' | 'OR' = 'AND'
): boolean {
  if (requirements.length === 0) return true

  if (logic === 'AND') {
    return requirements.every(req =>
      checkPermission(userPermissions, departmentModules, dataScope, req)
    )
  } else {
    return requirements.some(req =>
      checkPermission(userPermissions, departmentModules, dataScope, req)
    )
  }
}

/**
 * 创建带配置的权限守卫中间件
 * 支持 AND/OR 组合逻辑、跳过权限检查、自定义错误消息
 * 
 * @example
 * // 单个权限检查
 * createPermissionGuard({ permissions: { module: 'finance', subModule: 'flow', action: 'view' } })
 * 
 * @example
 * // 多个权限 AND 逻辑
 * createPermissionGuard({
 *   permissions: [
 *     { module: 'finance', subModule: 'flow', action: 'view' },
 *     { module: 'finance', subModule: 'flow', action: 'create' }
 *   ],
 *   logic: 'AND'
 * })
 * 
 * @example
 * // 多个权限 OR 逻辑
 * createPermissionGuard({
 *   permissions: [
 *     { module: 'finance', subModule: 'flow', action: 'view' },
 *     { module: 'hr', subModule: 'employee', action: 'view' }
 *   ],
 *   logic: 'OR'
 * })
 * 
 * @example
 * // 跳过权限检查（公开接口）
 * createPermissionGuard({ permissions: [], skip: true })
 */
export function createPermissionGuard(config: PermissionGuardConfig) {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    // 如果配置了跳过权限检查，直接放行
    if (config.skip) {
      await next()
      return
    }

    // 获取用户权限信息
    const userPosition = c.get('userPosition')
    const departmentModules = c.get('departmentModules') || ['*']

    // 未认证用户
    if (!userPosition || !userPosition.permissions) {
      throw Errors.UNAUTHORIZED('请先登录')
    }

    // 规范化权限要求为数组
    const requirements = Array.isArray(config.permissions)
      ? config.permissions
      : [config.permissions]

    // 如果没有权限要求，直接放行
    if (requirements.length === 0) {
      await next()
      return
    }

    // 检查权限
    const logic = config.logic || 'AND'
    const hasRequiredPermission = checkPermissions(
      userPosition.permissions,
      departmentModules,
      userPosition.dataScope || 'self',
      requirements,
      logic
    )

    if (!hasRequiredPermission) {
      const errorMessage = config.errorMessage || '权限不足'
      throw createError(403, ErrorCodes.AUTH_FORBIDDEN, errorMessage, {
        required: requirements,
        logic,
      })
    }

    await next()
  })
}

/**
 * Middleware to check if the user has the required permission.
 * @param module Module name (e.g., 'asset')
 * @param subModule Sub-module name (e.g., 'fixed')
 * @param action Action name (e.g., 'create')
 * @deprecated Use createPermissionGuard instead for new code
 */
export function requirePermission(module: string, subModule: string, action: string) {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(module, subModule, action)) {
      throw Errors.FORBIDDEN()
    }
    await next()
  })
}

/**
 * Wrapper for OpenAPI routes to check permission.
 * @param module Module name
 * @param subModule Sub-module name
 * @param action Action name
 * @param handler Route handler
 * @deprecated Use createPermissionContext in route handlers instead
 */
 
export function protectRoute(
  module: string,
  subModule: string,
  action: string,
  handler: (c: any) => any
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(module, subModule, action)) {
      throw Errors.FORBIDDEN()
    }
    return handler(c)
  }
}
