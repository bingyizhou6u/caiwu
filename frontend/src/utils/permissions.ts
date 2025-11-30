import { api } from '../config/api'
import { useAuth } from '../context/AuthContext'

/**
 * 权限辅助工具 - 基于新的职位权限系统
 * 
 * 新的权限结构:
 * user.position.permissions = {
 *   finance: { flow: ['view', 'create', 'update', 'delete'], ... },
 *   hr: { employee: ['view', 'create'], ... },
 *   ...
 * }
 */

// ==================== 新的权限检查函数 ====================

/**
 * 检查用户是否有指定权限
 * @param userInfo - 用户信息对象 (从useAuth获取)
 * @param module - 模块名称 (如 'finance', 'hr')
 * @param subModule - 子模块名称 (如 'flow', 'employee')
 * @param action - 操作名称 (如 'view', 'create', 'update', 'delete')
 */
export function hasPermission(
  userInfo: any,
  module: string,
  subModule?: string,
  action?: string
): boolean {
  if (!userInfo?.position?.permissions) return false

  const modulePerms = userInfo.position.permissions[module]
  if (!modulePerms) return false

  // 如果只检查模块权限
  if (!subModule) return true

  const subModulePerms = modulePerms[subModule]
  if (!subModulePerms || !Array.isArray(subModulePerms)) return false

  // 如果只检查子模块权限
  if (!action) return subModulePerms.length > 0

  // 检查具体操作权限
  return subModulePerms.includes(action)
}

/**
 * React Hook - 返回权限检查函数
 * 使用方式:
 * const { hasPermission, user, canManageSubordinates } = usePermissions()
 * if (hasPermission('finance', 'flow', 'create')) { ... }
 */
export function usePermissions() {
  const { user } = useAuth()

  const checkPermission = (
    module: string,
    subModule?: string,
    action?: string
  ) => hasPermission(user, module, subModule, action)

  return {
    user,
    hasPermission: checkPermission,
    canManageSubordinates: user?.position?.can_manage_subordinates === 1,
    positionCode: user?.position?.code,
    positionLevel: user?.position?.level,
    functionRole: user?.position?.function_role,
  }
}

// ==================== 旧的权限系统(已废弃,保留用于兼容) ====================

// 权限缓存
let permissionsCache: any = null
let permissionsLoading = false

// 获取当前用户权限
export async function getMyPermissions(): Promise<any> {
  if (permissionsCache) {
    return permissionsCache
  }
  
  if (permissionsLoading) {
    // 如果正在加载，等待
    await new Promise(resolve => setTimeout(resolve, 100))
    return permissionsCache || { permissions: { menus: {}, actions: {} } }
  }
  
  permissionsLoading = true
  try {
    const res = await fetch(api.myPermissions, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      permissionsCache = data.permissions || { menus: {}, actions: {} }
      return permissionsCache
    }
  } catch (error) {
    console.error('Failed to load permissions:', error)
  } finally {
    permissionsLoading = false
  }
  
  return { menus: {}, actions: {} }
}

// 清除权限缓存（登录/登出时调用）
export function clearPermissionsCache() {
  permissionsCache = null
}

// 检查是否有菜单权限
export async function hasMenuPermission(menu: string, action: 'read' | 'write' | 'create' | 'delete' = 'read'): Promise<boolean> {
  const perms = await getMyPermissions()
  
  // manager角色默认有全权限
  // 这里可以根据实际需求调整
  
  // 检查菜单权限
  if (perms.menus['*'] && perms.menus['*'].includes(action)) {
    return true
  }
  
  if (perms.menus[menu] && perms.menus[menu].includes(action)) {
    return true
  }
  
  return false
}

// 检查是否有操作权限（同步版本，用于组件中）
export function checkPermission(menu: string, action: 'read' | 'write' | 'create' | 'delete' = 'read'): boolean {
  if (!permissionsCache) {
    // 如果权限未加载，默认允许（向后兼容）
    return true
  }
  
  // manager角色默认有全权限
  if (permissionsCache.menus['*'] && permissionsCache.menus['*'].includes(action)) {
    return true
  }
  
  if (permissionsCache.menus[menu] && permissionsCache.menus[menu].includes(action)) {
    return true
  }
  
  return false
}

// 初始化权限（在App组件中调用）
export async function initPermissions() {
  await getMyPermissions()
}

