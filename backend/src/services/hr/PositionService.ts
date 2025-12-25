/**
 * 职位管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { positions, orgDepartments, departments, employees } from '../../db/schema.js'
import { eq, and, or } from 'drizzle-orm'
import { Errors } from '../../utils/errors.js'
import { v4 as uuid } from 'uuid'

export class PositionService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async getPositions() {
    return this.db
      .select()
      .from(positions)
      .where(eq(positions.active, 1))
      .orderBy(positions.sortOrder, positions.name)
      .all()
  }

  async getAvailablePositions(orgDepartmentId?: string) {
    // 返回所有可用职位，按 dataScope 分组，让调用方根据需要筛选

    const positionsList = await this.db
      .select()
      .from(positions)
      .where(eq(positions.active, 1))
      .orderBy(positions.dataScope, positions.sortOrder, positions.name)
      .all()

    // 按 dataScope 分组
    const SCOPE_LABELS: Record<string, string> = {
      'all': '全公司职位',
      'project': '项目职位',
      'group': '组级职位',
      'self': '个人职位',
    }
    const groupedPositions: Record<string, typeof positionsList> = {}
    for (const pos of positionsList) {
      const groupKey = SCOPE_LABELS[pos.dataScope] || `其他(dataScope=${pos.dataScope})`
      if (!groupedPositions[groupKey]) {
        groupedPositions[groupKey] = []
      }
      groupedPositions[groupKey].push(pos)
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
