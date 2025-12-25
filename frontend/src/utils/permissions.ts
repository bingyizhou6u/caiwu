import { useAppStore } from '../store/useAppStore'

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
 * React Hook - 返回权限检查函数
 * 使用方式:
 * const { hasPermission, user, canManageSubordinates, dataScope } = usePermissions()
 * if (hasPermission('finance', 'flow', 'create')) { ... }
 */
export function usePermissions() {
  const { userInfo: user } = useAppStore()

  const checkPermission = (
    module: string,
    subModule?: string,
    action?: string
  ) => hasPermission(user, module, subModule, action)

  // 检查是否是管理者(有管理下属权限)
  const isManager = () => {
    if (!user?.position) return false
    return user.position.canManageSubordinates === 1
  }

  // 检查是否是总部人员 (基于 dataScope)
  const isHQ = () => {
    if (!user?.position?.dataScope) return false
    return user.position.dataScope === 'all'
  }

  // 检查是否是财务人员
  const isFinance = () => {
    if (!user?.position) return false
    return user.position.functionRole === 'finance'
  }

  // 检查是否是HR人员
  const isHR = () => {
    if (!user?.position) return false
    return user.position.functionRole === 'hr'
  }

  // 获取职能角色
  const functionRole = user?.position?.functionRole || null
  // 获取数据范围
  const dataScope = user?.position?.dataScope || 'self'

  return {
    user,
    hasPermission: checkPermission,
    canManageSubordinates: user?.position?.canManageSubordinates === 1,
    positionCode: user?.position?.code,
    positionLevel: user?.position?.level,
    dataScope,
    functionRole,
    isManager,
    isHQ,
    isFinance,
    isHR,
  }
}
