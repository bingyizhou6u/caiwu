/**
 * 组织部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { orgDepartments, positions, departments } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
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

    const rows = await this.db
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
        parentName: parent.name,
        projectName: d.name,
      })
      .from(od)
      .leftJoin(p, eq(p.id, od.defaultPositionId))
      .leftJoin(parent, eq(parent.id, od.parentId))
      .leftJoin(d, eq(d.id, od.projectId))
      .where(and(...conditions))
      .orderBy(
        od.sortOrder,
        od.name
      )
      .all()

    return rows.map(row => ({
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

