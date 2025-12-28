/**
 * 职位管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { positions, orgDepartments, projects, employees } from '../../db/schema.js'
import { eq, and, or, asc, desc } from 'drizzle-orm'
import { Errors } from '../../utils/errors.js'
import { v4 as uuid } from 'uuid'

export class PositionService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async getPositions() {
    const positionsList = await this.db
      .select()
      .from(positions)
      .where(eq(positions.active, 1))
      .all()

    // 在内存中排序（D1 对多个字段的 ORDER BY 支持不稳定）
    positionsList.sort((a, b) => {
      const sortA = a.sortOrder || 0
      const sortB = b.sortOrder || 0
      if (sortA !== sortB) {
        return sortA - sortB
      }
      return (a.name || '').localeCompare(b.name || '')
    })

    return positionsList
  }

  async getAvailablePositions(orgDepartmentId?: string) {
    // 1. 获取所有活跃职位
    let positionsList = await this.db
      .select()
      .from(positions)
      .where(eq(positions.active, 1))
      .all()

    // 2. 如果指定了部门，获取该部门的 allowedPositions 并过滤
    if (orgDepartmentId) {
      const dept = await this.db
        .select({ allowedPositions: orgDepartments.allowedPositions })
        .from(orgDepartments)
        .where(eq(orgDepartments.id, orgDepartmentId))
        .get()

      if (dept?.allowedPositions) {
        try {
          const allowedIds: string[] = JSON.parse(dept.allowedPositions)
          if (Array.isArray(allowedIds) && allowedIds.length > 0) {
            // 过滤：仅保留 allowedPositions 中的职位
            positionsList = positionsList.filter(p => allowedIds.includes(p.id))
          }
        } catch (e) {
          // JSON 解析失败，忽略过滤
        }
      }
    }

    // 3. 在内存中排序
    positionsList.sort((a, b) => {
      // 按 level 排序 (1 -> 2 -> 3)
      if (a.level !== b.level) {
        return a.level - b.level
      }
      // 按 dataScope 排序 (all -> project -> group -> self)
      const scopeOrder = { 'all': 1, 'project': 2, 'group': 3, 'self': 4 }
      const scopeA = scopeOrder[a.dataScope as keyof typeof scopeOrder] || 99
      const scopeB = scopeOrder[b.dataScope as keyof typeof scopeOrder] || 99
      if (scopeA !== scopeB) {
        return scopeA - scopeB
      }
      // 按 sortOrder 排序
      const sortA = a.sortOrder || 0
      const sortB = b.sortOrder || 0
      if (sortA !== sortB) {
        return sortA - sortB
      }
      // 按 name 排序
      return (a.name || '').localeCompare(b.name || '')
    })

    // 4. 分组逻辑
    const groupedPositions: Record<string, typeof positionsList> = {}

    // 初始化分组顺序
    const ORDERED_GROUPS = ['总部职位', '项目职位', '组级职位', '个人职位', '其他职位']
    ORDERED_GROUPS.forEach(key => groupedPositions[key] = [])

    for (const pos of positionsList) {
      let groupKey = '其他职位'

      if (pos.level === 1) {
        groupKey = '总部职位'
      } else if (pos.level === 2) {
        groupKey = '项目职位'
      } else if (pos.level === 3) {
        // Level 3 用于 组长(Group Scope) 和 组员(Self Scope)
        if (pos.dataScope === 'group') {
          groupKey = '组级职位'
        } else {
          groupKey = '个人职位'
        }
      }

      groupedPositions[groupKey].push(pos)
    }

    // 清理空分组
    for (const key of Object.keys(groupedPositions)) {
      if (groupedPositions[key].length === 0) {
        delete groupedPositions[key]
      }
    }

    return {
      results: positionsList,
      grouped: groupedPositions,
    }
  }

  async createPosition(data: {
    code: string
    name: string
    canManageSubordinates?: number
    dataScope?: string
    description?: string
    permissions?: string
    sortOrder?: number
  }) {
    // 检查 code 是否已存在
    const existing = await this.db.query.positions.findFirst({
      where: eq(positions.code, data.code),
    })
    if (existing) {
      throw Errors.DUPLICATE('职位代码')
    }

    const id = uuid()
    const now = Date.now()
    await this.db
      .insert(positions)
      .values({
        id,
        code: data.code,
        name: data.name,
        canManageSubordinates: data.canManageSubordinates ?? 0,
        dataScope: (data.dataScope as any) || 'self',
        description: data.description,
        permissions: data.permissions || '{}',
        sortOrder: data.sortOrder ?? 0,
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { id, ...data }
  }

  async updatePosition(
    id: string,
    data: {
      code?: string
      name?: string
      level?: number
      canManageSubordinates?: number
      dataScope?: string
      description?: string
      permissions?: string
      sortOrder?: number
      active?: number
    }
  ) {
    const position = await this.db.query.positions.findFirst({
      where: eq(positions.id, id),
    })
    if (!position) {
      throw Errors.NOT_FOUND('职位')
    }

    // 如果更新 code，检查是否与其他职位冲突
    if (data.code && data.code !== position.code) {
      const existing = await this.db.query.positions.findFirst({
        where: eq(positions.code, data.code),
      })
      if (existing) {
        throw Errors.DUPLICATE('职位代码')
      }
    }

    const updates: any = { updatedAt: Date.now() }
    if (data.code !== undefined) updates.code = data.code
    if (data.name !== undefined) updates.name = data.name
    if (data.level !== undefined) updates.level = data.level
    if (data.canManageSubordinates !== undefined)
      updates.canManageSubordinates = data.canManageSubordinates
    if (data.dataScope !== undefined) updates.dataScope = data.dataScope
    if (data.description !== undefined) updates.description = data.description
    if (data.permissions !== undefined) updates.permissions = data.permissions
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder
    if (data.active !== undefined) updates.active = data.active

    await this.db.update(positions).set(updates).where(eq(positions.id, id)).execute()
    return { ok: true }
  }

  async deletePosition(id: string) {
    const position = await this.db.query.positions.findFirst({
      where: eq(positions.id, id),
    })
    if (!position) {
      throw Errors.NOT_FOUND('职位')
    }

    // 检查是否有员工使用此职位
    const employeeCount = await this.db
      .select()
      .from(employees)
      .where(eq(employees.positionId, id))
      .limit(1)
      .all()

    if (employeeCount.length > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该职位还有员工使用')
    }

    // 软删除：设置为 inactive
    await this.db
      .update(positions)
      .set({ active: 0, updatedAt: Date.now() })
      .where(eq(positions.id, id))
      .execute()

    return { ok: true, name: position.name }
  }
}
