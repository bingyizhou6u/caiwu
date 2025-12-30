/**
 * 权限审计服务
 * 记录权限相关的变更操作，包括职位权限、员工职位变更、部门模块权限等
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { businessOperationHistory, employees } from '../../db/schema.js'
import { uuid } from '../../utils/db.js'
import { Logger } from '../../utils/logger.js'

/**
 * 权限变更类型
 */
export type PermissionChangeType =
  | 'position_permission_update'
  | 'employee_position_change'
  | 'department_module_update'

/**
 * 权限变更记录
 */
export interface PermissionChangeRecord {
  changeType: PermissionChangeType
  entityType: string
  entityId: string
  beforeData: any
  afterData: any
  operatorId: string
  operatorName?: string
  ip?: string
  memo?: string
}

/**
 * 权限差异结果
 */
export interface PermissionDiff {
  added: Record<string, Record<string, string[]>>
  removed: Record<string, Record<string, string[]>>
  changed: Record<string, { before: Record<string, string[]>; after: Record<string, string[]> }>
}

/**
 * 审计日志查询结果
 */
export interface PermissionHistoryRecord {
  id: string
  entityType: string
  entityId: string
  action: string
  operatorId: string | null
  operatorName: string | null
  beforeData: any
  afterData: any
  memo: string | null
  createdAt: number
}

export class PermissionAuditService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * 记录权限变更
   */
  async logPermissionChange(record: PermissionChangeRecord): Promise<void> {
    // 获取操作人姓名（如果未提供）
    let operatorName: string | undefined = record.operatorName
    if (!operatorName && record.operatorId) {
      try {
        const operator = await this.db
          .select({ name: employees.name })
          .from(employees)
          .where(eq(employees.id, record.operatorId))
          .get()
        operatorName = operator?.name || undefined
      } catch (error) {
        Logger.warn('Failed to get operator name for permission audit', { error })
      }
    }

    // 构建 action 字符串
    const action = this.buildActionString(record.changeType)

    await this.db.insert(businessOperationHistory).values({
      id: uuid(),
      entityType: record.entityType,
      entityId: record.entityId,
      action,
      operatorId: record.operatorId,
      operatorName: operatorName || undefined,
      beforeData: record.beforeData ? JSON.stringify(record.beforeData) : null,
      afterData: record.afterData ? JSON.stringify(record.afterData) : null,
      memo: this.buildMemo(record),
      createdAt: Date.now(),
    })
  }

  /**
   * 查询权限变更历史
   */
  async getPermissionHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PermissionHistoryRecord[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const history = await this.db
      .select()
      .from(businessOperationHistory)
      .where(
        and(
          eq(businessOperationHistory.entityType, entityType),
          eq(businessOperationHistory.entityId, entityId)
        )
      )
      .orderBy(desc(businessOperationHistory.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return history.map(h => ({
      id: h.id,
      entityType: h.entityType,
      entityId: h.entityId,
      action: h.action,
      operatorId: h.operatorId,
      operatorName: h.operatorName,
      beforeData: h.beforeData ? JSON.parse(h.beforeData) : null,
      afterData: h.afterData ? JSON.parse(h.afterData) : null,
      memo: h.memo,
      createdAt: h.createdAt,
    }))
  }

  /**
   * 按变更类型查询权限历史
   */
  async getPermissionHistoryByType(
    changeType: PermissionChangeType,
    options?: { limit?: number; offset?: number }
  ): Promise<PermissionHistoryRecord[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0
    const action = this.buildActionString(changeType)

    const history = await this.db
      .select()
      .from(businessOperationHistory)
      .where(eq(businessOperationHistory.action, action))
      .orderBy(desc(businessOperationHistory.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return history.map(h => ({
      id: h.id,
      entityType: h.entityType,
      entityId: h.entityId,
      action: h.action,
      operatorId: h.operatorId,
      operatorName: h.operatorName,
      beforeData: h.beforeData ? JSON.parse(h.beforeData) : null,
      afterData: h.afterData ? JSON.parse(h.afterData) : null,
      memo: h.memo,
      createdAt: h.createdAt,
    }))
  }

  /**
   * 计算权限差异
   * 比较两个权限对象，返回新增、删除和变更的权限
   */
  static diffPermissions(
    before: Record<string, Record<string, string[]>> | null | undefined,
    after: Record<string, Record<string, string[]>> | null | undefined
  ): PermissionDiff {
    const beforePerms = before || {}
    const afterPerms = after || {}

    const added: Record<string, Record<string, string[]>> = {}
    const removed: Record<string, Record<string, string[]>> = {}
    const changed: Record<string, { before: Record<string, string[]>; after: Record<string, string[]> }> = {}

    // 获取所有模块
    const allModules = new Set([...Object.keys(beforePerms), ...Object.keys(afterPerms)])

    for (const module of allModules) {
      const beforeModule = beforePerms[module] || {}
      const afterModule = afterPerms[module] || {}

      // 模块在 before 中不存在，after 中存在 -> 新增
      if (!beforePerms[module] && afterPerms[module]) {
        added[module] = afterModule
        continue
      }

      // 模块在 before 中存在，after 中不存在 -> 删除
      if (beforePerms[module] && !afterPerms[module]) {
        removed[module] = beforeModule
        continue
      }

      // 模块在两边都存在，比较子模块
      const allSubModules = new Set([...Object.keys(beforeModule), ...Object.keys(afterModule)])
      let hasChanges = false
      const moduleAdded: Record<string, string[]> = {}
      const moduleRemoved: Record<string, string[]> = {}
      const moduleBefore: Record<string, string[]> = {}
      const moduleAfter: Record<string, string[]> = {}

      for (const subModule of allSubModules) {
        const beforeActions = beforeModule[subModule] || []
        const afterActions = afterModule[subModule] || []

        // 比较 actions
        const beforeSet = new Set(beforeActions)
        const afterSet = new Set(afterActions)

        const addedActions = afterActions.filter(a => !beforeSet.has(a))
        const removedActions = beforeActions.filter(a => !afterSet.has(a))

        if (addedActions.length > 0 || removedActions.length > 0) {
          hasChanges = true
          moduleBefore[subModule] = beforeActions
          moduleAfter[subModule] = afterActions
        }
      }

      if (hasChanges) {
        changed[module] = { before: beforeModule, after: afterModule }
      }
    }

    return { added, removed, changed }
  }

  /**
   * 构建 action 字符串
   */
  private buildActionString(changeType: PermissionChangeType): string {
    switch (changeType) {
      case 'position_permission_update':
        return 'permission_update'
      case 'employee_position_change':
        return 'position_change'
      case 'department_module_update':
        return 'module_update'
      default:
        return changeType
    }
  }

  /**
   * 构建备注信息
   */
  private buildMemo(record: PermissionChangeRecord): string {
    const parts: string[] = []

    if (record.ip) {
      parts.push(`IP: ${record.ip}`)
    }

    if (record.memo) {
      parts.push(record.memo)
    }

    // 添加变更类型描述
    switch (record.changeType) {
      case 'position_permission_update':
        parts.unshift('职位权限变更')
        break
      case 'employee_position_change':
        parts.unshift('员工职位变更')
        break
      case 'department_module_update':
        parts.unshift('部门模块权限变更')
        break
    }

    return parts.join(' | ')
  }
}
