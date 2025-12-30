/**
 * 组织部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { orgDepartments, positions, projects } from '../../db/schema.js'
import { eq, and, inArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Errors } from '../../utils/errors.js'
import { PermissionAuditService } from './PermissionAuditService.js'
import { PermissionCache } from '../../utils/permission-cache.js'

export class OrgDepartmentService {
  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private permissionAuditService?: PermissionAuditService,
    private permissionCache?: PermissionCache
  ) { }

  async getOrgDepartments(projectId?: string) {
    // 使用别名表处理自连接
    const od = orgDepartments
    const parent = alias(orgDepartments, 'parent')
    const p = positions
    const d = projects

    const conditions = [eq(od.active, 1)]
    if (projectId) {
      // 直接使用 projectId 查询
      conditions.push(eq(od.projectId, projectId))

      // 如果查询结果为空，检查是否为总部部门（hqId 为 null 表示该 department 本身就是总部）
      const projectDept = await this.db
        .select({ hqId: projects.hqId })
        .from(projects)
        .where(eq(projects.id, projectId))
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

  /**
   * 创建组织部门
   */
  async createOrgDepartment(data: {
    projectId: string
    parentId?: string | null
    name: string
    code?: string | null
    description?: string | null
    allowedModules?: string[] | null
    allowedPositions?: string[] | null
    defaultPositionId?: string | null
    sortOrder?: number
  }) {
    const id = crypto.randomUUID()
    const now = Date.now()

    await this.db.insert(orgDepartments).values({
      id,
      projectId: data.projectId,
      parentId: data.parentId || null,
      name: data.name,
      code: data.code || null,
      description: data.description || null,
      allowedModules: data.allowedModules ? JSON.stringify(data.allowedModules) : null,
      allowedPositions: data.allowedPositions ? JSON.stringify(data.allowedPositions) : null,
      defaultPositionId: data.defaultPositionId || null,
      sortOrder: data.sortOrder ?? 0,
      active: 1,
      createdAt: now,
      updatedAt: now,
    })

    return this.getOrgDepartment(id)
  }

  /**
   * 更新组织部门
   */
  async updateOrgDepartment(
    id: string,
    data: {
      parentId?: string | null
      name?: string
      code?: string | null
      description?: string | null
      allowedModules?: string[] | null
      allowedPositions?: string[] | null
      defaultPositionId?: string | null
      sortOrder?: number
      active?: number
    },
    operatorId?: string,
    ip?: string
  ) {
    const existing = await this.getOrgDepartment(id)
    if (!existing) {
      throw Errors.NOT_FOUND('部门不存在')
    }

    // 记录模块权限变更前的信息
    const oldAllowedModules = existing.allowedModules
    const modulesChanged = data.allowedModules !== undefined &&
      JSON.stringify(data.allowedModules) !== JSON.stringify(oldAllowedModules)

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    }

    if (data.parentId !== undefined) updateData.parentId = data.parentId
    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code
    if (data.description !== undefined) updateData.description = data.description
    if (data.allowedModules !== undefined) {
      updateData.allowedModules = data.allowedModules ? JSON.stringify(data.allowedModules) : null
    }
    if (data.allowedPositions !== undefined) {
      updateData.allowedPositions = data.allowedPositions ? JSON.stringify(data.allowedPositions) : null
    }
    if (data.defaultPositionId !== undefined) updateData.defaultPositionId = data.defaultPositionId
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.active !== undefined) updateData.active = data.active

    await this.db.update(orgDepartments).set(updateData).where(eq(orgDepartments.id, id))

    // 记录模块权限变更审计
    if (modulesChanged && this.permissionAuditService && operatorId) {
      await this.permissionAuditService.logPermissionChange({
        changeType: 'department_module_update',
        entityType: 'org_department',
        entityId: id,
        beforeData: {
          allowedModules: oldAllowedModules,
          name: existing.name,
        },
        afterData: {
          allowedModules: data.allowedModules,
          name: data.name ?? existing.name,
        },
        operatorId,
        ip,
      })
    }

    // 失效权限缓存（如果模块权限有变更）
    if (modulesChanged && this.permissionCache) {
      // 异步失效缓存，不阻塞响应
      this.permissionCache.invalidateByDepartmentId(id).catch(err => {
        // 静默失败，已在 PermissionCache 中记录日志
      })
    }

    return this.getOrgDepartment(id)
  }

  /**
   * 删除组织部门（软删除）
   */
  async deleteOrgDepartment(id: string) {
    const existing = await this.getOrgDepartment(id)
    if (!existing) {
      throw Errors.NOT_FOUND('部门不存在')
    }

    // 检查是否有子部门
    const children = await this.db
      .select({ id: orgDepartments.id })
      .from(orgDepartments)
      .where(and(eq(orgDepartments.parentId, id), eq(orgDepartments.active, 1)))
      .all()

    if (children.length > 0) {
      throw Errors.VALIDATION_ERROR('该部门下还有子部门，无法删除')
    }

    // 检查是否有员工
    const { employees } = await import('../../db/schema.js')
    const employeeCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(and(eq(employees.orgDepartmentId, id), eq(employees.active, 1)))
      .get()

    if (employeeCount && employeeCount.count > 0) {
      throw Errors.VALIDATION_ERROR('该部门下还有员工，无法删除')
    }

    // 软删除
    await this.db
      .update(orgDepartments)
      .set({ active: 0, updatedAt: Date.now() })
      .where(eq(orgDepartments.id, id))

    return { success: true }
  }
}

