/**
 * 组织部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { orgDepartments, positions, departments } from '../db/schema.js'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Errors } from '../utils/errors.js'

export class OrgDepartmentService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getOrgDepartments(projectId?: string) {
    // 使用别名表处理自连接
    const od = orgDepartments
    const parent = alias(orgDepartments, 'parent')
    const p = positions
    const d = departments

    const conditions = [eq(od.active, 1)]
    if (projectId) {
      if (projectId === 'hq') {
        conditions.push(isNull(od.projectId))
      } else {
        conditions.push(eq(od.projectId, projectId))
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
        desc(isNull(od.projectId)),
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

