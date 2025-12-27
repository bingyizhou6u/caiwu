/**
 * 组织部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { orgDepartments, positions, departments } from '../../db/schema.js'
import { eq, and, inArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Errors } from '../../utils/errors.js'

export class OrgDepartmentService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async getOrgDepartments(projectId?: string) {
    // 使用别名表处理自连接
    const od = orgDepartments
    const parent = alias(orgDepartments, 'parent')
    const p = positions
    const d = departments

    const conditions = [eq(od.active, 1)]
    if (projectId) {
      // 直接使用 projectId 查询
      conditions.push(eq(od.projectId, projectId))

      // 如果查询结果为空，检查是否为总部部门（hqId 为 null 表示该 department 本身就是总部）
      const projectDept = await this.db
        .select({ hqId: departments.hqId })
        .from(departments)
        .where(eq(departments.id, projectId))
        .get()

      // 如果 hqId 为 null，说明这是一个总部级别的 department
      if (projectDept && projectDept.hqId === null) {
        // 检查是否已有组织部门
        const existingCount = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(od)
          .where(and(eq(od.projectId, projectId), eq(od.active, 1)))
          .get()

        // 如果没有组织部门，自动创建
        if (!existingCount || existingCount.count === 0) {
          const { DepartmentService } = await import('./DepartmentService.js')
          const { AuditService } = await import('./AuditService.js')
          const auditService = new AuditService(this.db)
          const deptService = new DepartmentService(this.db, auditService)
          await deptService.createDefaultOrgDepartments(projectId, undefined)
        }
      }
    }

    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    // 1. 查询组织部门
    const rows = await this.db
      .select()
      .from(od)
      .where(and(...conditions))
      .orderBy(
        od.sortOrder,
        od.name
      )
      .all()

    if (rows.length === 0) {
      return []
    }

    // 2. 批量查询关联数据
    const positionIds = [...new Set(rows.map(r => r.defaultPositionId).filter(Boolean) as string[])]
    const parentIds = [...new Set(rows.map(r => r.parentId).filter(Boolean) as string[])]
    const projectIds = [...new Set(rows.map(r => r.projectId).filter(Boolean) as string[])]

    const [positionsList, parentsList, projectsList] = await Promise.all([
      positionIds.length > 0
        ? this.db
            .select({ id: p.id, name: p.name })
            .from(p)
            .where(inArray(p.id, positionIds))
            .all()
        : Promise.resolve([]),
      parentIds.length > 0
        ? this.db
            .select({ id: parent.id, name: parent.name })
            .from(parent)
            .where(inArray(parent.id, parentIds))
            .all()
        : Promise.resolve([]),
      projectIds.length > 0
        ? this.db
            .select({ id: d.id, name: d.name })
            .from(d)
            .where(inArray(d.id, projectIds))
            .all()
        : Promise.resolve([]),
    ])

    // 3. 创建映射表
    const positionMap = new Map(positionsList.map(p => [p.id, p]))
    const parentMap = new Map(parentsList.map(par => [par.id, par]))
    const projectMap = new Map(projectsList.map(proj => [proj.id, proj]))

    // 4. 组装结果
    const rowsWithDetails = rows.map(row => ({
      ...row,
      defaultPositionName: row.defaultPositionId ? positionMap.get(row.defaultPositionId)?.name || null : null,
      parentName: row.parentId ? parentMap.get(row.parentId)?.name || null : null,
      projectName: row.projectId ? projectMap.get(row.projectId)?.name || null : null,
    }))

    return rowsWithDetails.map(row => ({
      ...row,
      allowedModules: row.allowedModules ? JSON.parse(row.allowedModules) : ['*'],
      allowedPositions: row.allowedPositions ? JSON.parse(row.allowedPositions) : null,
    }))
  }

  async getOrgDepartment(id: string) {
    const od = orgDepartments
    const p = positions

    const row = await this.db
      .select({
        id: od.id,
        projectId: od.projectId,
        parentId: od.parentId,
        name: od.name,
        code: od.code,
        description: od.description,
        allowedModules: od.allowedModules,
        allowedPositions: od.allowedPositions,
        defaultPositionId: od.defaultPositionId,
        active: od.active,
        sortOrder: od.sortOrder,
        createdAt: od.createdAt,
        updatedAt: od.updatedAt,
        defaultPositionName: p.name,
      })
      .from(od)
      .leftJoin(p, eq(p.id, od.defaultPositionId))
      .where(eq(od.id, id))
      .get()

    if (!row) {
      throw Errors.NOT_FOUND('部门不存在')
    }

    return {
      ...row,
      allowedModules: row.allowedModules ? JSON.parse(row.allowedModules) : ['*'],
      allowedPositions: row.allowedPositions ? JSON.parse(row.allowedPositions) : null,
    }
  }
}

