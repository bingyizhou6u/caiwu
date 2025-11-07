import { api } from '../config/api'

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

