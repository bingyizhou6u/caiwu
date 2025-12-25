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
 * 
 * 使用方式:
 * const { hasPermission, dataScope, functionRole, canManageSubordinates } = usePermissions()
 * if (hasPermission('finance', 'flow', 'create')) { ... }
 * if (dataScope === 'all') { // 总部权限 }
 * if (functionRole === 'finance') { // 财务人员 }
 * if (canManageSubordinates) { // 有管理下属权限 }
 */
export function usePermissions() {
  const { userInfo: user } = useAppStore()

  const checkPermission = (
    module: string,
    subModule?: string,
    action?: string
  ) => hasPermission(user, module, subModule, action)

  // 核心属性值
  const dataScope = user?.position?.dataScope || 'self'
  const functionRole = user?.position?.functionRole || null
  const canManageSubordinates = user?.position?.canManageSubordinates === 1

  return {
    user,
    hasPermission: checkPermission,
    // 数据范围: 'all' | 'project' | 'group' | 'self'
    dataScope,
    // 职能角色: 'director' | 'hr' | 'finance' | 'admin' | 'developer' | 'support' | 'member'
    functionRole,
    // 是否有管理下属权限
    canManageSubordinates,
    // 职位信息 (如需要更细粒度的判断)
    positionCode: user?.position?.code,
    positionLevel: user?.position?.level,
  }
}

