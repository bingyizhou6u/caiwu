import { useAppStore } from '../store/useAppStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api as apiClient } from '../api/http'
import { api } from '../config/api'

/**
 * 权限辅助工具 - 基于职位权限系统
 * 
 * 权限结构:
 * user.position.permissions = {
 *   finance: { flow: ['view', 'create', 'update', 'delete'], ... },
 *   hr: { employee: ['view', 'create'], ... },
 *   ...
 * }
 */

/**
 * 权限上下文数据类型（与后端 PermissionContextJSON 对应）
 */
export interface PermissionContextData {
  employeeId: string
  position: {
    id: string
    code: string
    name: string
  }
  permissions: Record<string, Record<string, string[]>>
  dataScope: 'all' | 'project' | 'group' | 'self'
  canManageSubordinates: boolean
  allowedModules: string[]
  projectId: string | null
  orgDepartmentId: string | null
}

/**
 * 检查用户是否有指定权限
 * @param userInfo - 用户信息对象 (从useAppStore获取)
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
 * 基于 PermissionContextData 检查权限
 * @param permissionData - 权限上下文数据
 * @param module - 模块名称
 * @param subModule - 子模块名称（可选）
 * @param action - 操作名称（可选）
 */
export function checkPermission(
  permissionData: PermissionContextData | null,
  module: string,
  subModule?: string,
  action?: string
): boolean {
  if (!permissionData?.permissions) return false

  const modulePerms = permissionData.permissions[module]
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
 * 检查模块是否被部门允许
 * @param permissionData - 权限上下文数据
 * @param module - 模块名称
 */
export function isModuleAllowed(
  permissionData: PermissionContextData | null,
  module: string
): boolean {
  if (!permissionData) return false

  // dataScope='all' (通常是总部) 不受部门模块限制
  if (permissionData.dataScope === 'all') return true

  const allowedModules = permissionData.allowedModules || []

  // 如果包含 '*'，表示允许所有模块
  if (allowedModules.includes('*')) return true

  // 检查模块是否匹配（支持通配符，如 hr.* 匹配 hr.employee、hr.leave 等）
  return allowedModules.some(m => {
    if (m.endsWith('.*')) {
      const prefix = m.slice(0, -2)
      return module === prefix || module.startsWith(prefix + '.')
    }
    return m === module || module.startsWith(m + '.')
  })
}

/**
 * 权限缓存 key
 */
const PERMISSIONS_QUERY_KEY = ['my', 'permissions']

/**
 * 权限缓存时间（5分钟）
 */
const PERMISSIONS_STALE_TIME = 5 * 60 * 1000

/**
 * 获取权限数据的 Hook
 * 从后端 /api/v2/my/permissions 接口获取完整权限信息
 */
export function usePermissionData() {
  const { token } = useAppStore()

  return useQuery<PermissionContextData>({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: async () => {
      return await apiClient.get<PermissionContextData>(api.my.permissions)
    },
    enabled: !!token,
    staleTime: PERMISSIONS_STALE_TIME,
    gcTime: 10 * 60 * 1000, // 10分钟后垃圾回收
    retry: 1,
  })
}

/**
 * 刷新权限缓存的 Hook
 */
export function useRefreshPermissions() {
  const queryClient = useQueryClient()

  return {
    /**
     * 刷新权限缓存
     */
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY })
    },
    /**
     * 清除权限缓存
     */
    clear: () => {
      queryClient.removeQueries({ queryKey: PERMISSIONS_QUERY_KEY })
    },
  }
}

/**
 * React Hook - 返回权限检查函数
 * 
 * 使用方式:
 * const { hasPermission, dataScope, canManageSubordinates } = usePermissions()
 * if (hasPermission('finance', 'flow', 'create')) { ... }
 * if (dataScope === 'all') { // 总部权限 }
 * if (canManageSubordinates) { // 有管理下属权限 }
 */
export function usePermissions() {
  const { userInfo: user } = useAppStore()

  const checkPermissionFn = (
    module: string,
    subModule?: string,
    action?: string
  ) => hasPermission(user, module, subModule, action)

  // 核心属性值
  const dataScope = user?.position?.dataScope || 'self'
  const canManageSubordinates = user?.position?.canManageSubordinates === 1

  return {
    user,
    hasPermission: checkPermissionFn,
    // 数据范围: 'all' | 'project' | 'group' | 'self'
    dataScope,
    // 是否有管理下属权限
    canManageSubordinates,
    // 职位信息 (如需要更细粒度的判断)
    positionCode: user?.position?.code,
  }
}

/**
 * 增强版权限 Hook - 使用后端权限接口
 * 
 * 使用方式:
 * const { hasPermission, dataScope, canManageSubordinates, isLoading, refresh } = useEnhancedPermissions()
 * if (hasPermission('finance', 'flow', 'create')) { ... }
 */
export function useEnhancedPermissions() {
  const { data: permissionData, isLoading, error } = usePermissionData()
  const { refresh, clear } = useRefreshPermissions()

  const checkPermissionFn = (
    module: string,
    subModule?: string,
    action?: string
  ) => checkPermission(permissionData ?? null, module, subModule, action)

  const checkModuleAllowed = (module: string) => 
    isModuleAllowed(permissionData ?? null, module)

  return {
    // 权限数据
    permissionData,
    // 加载状态
    isLoading,
    // 错误信息
    error,
    // 权限检查函数
    hasPermission: checkPermissionFn,
    // 模块是否允许
    isModuleAllowed: checkModuleAllowed,
    // 数据范围
    dataScope: permissionData?.dataScope || 'self',
    // 是否可管理下属
    canManageSubordinates: permissionData?.canManageSubordinates || false,
    // 允许的模块列表
    allowedModules: permissionData?.allowedModules || [],
    // 职位信息
    position: permissionData?.position,
    // 项目ID
    projectId: permissionData?.projectId,
    // 部门ID
    orgDepartmentId: permissionData?.orgDepartmentId,
    // 刷新权限
    refresh,
    // 清除缓存
    clear,
  }
}


