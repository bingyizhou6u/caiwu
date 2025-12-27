/**
 * 项目部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import { projects, sites, headquarters } from '../../db/schema.js'
import { eq, and, ne } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'

export class ProjectDepartmentService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  /**
   * 获取总部的 department ID
   */
  async getHQDepartmentId(): Promise<string | null> {
    const hqDept = await this.db.query.projects.findFirst({
      where: eq(projects.name, '总部'),
    })
    return hqDept?.id || null
  }

  /**
   * 获取或创建总部的 department ID
   */
  async getOrCreateHQDepartmentId(): Promise<string> {
    let hqDeptId = await this.getHQDepartmentId()
    if (!hqDeptId) {
      // 如果不存在总部部门，创建一个
      hqDeptId = uuid()
      // 查找或创建 headquarters 记录
      const defaultHq = await this.db.query.headquarters.findFirst()
      const hqId = defaultHq?.id || uuid()
      if (!defaultHq) {
        await this.db.insert(headquarters).values({ id: hqId, name: '总部', active: 1 }).execute()
      }
      await this.db
        .insert(projects)
        .values({
          id: hqDeptId,
          name: '总部',
          code: 'HQ',
          hqId,
          active: 1,
          sortOrder: 0, // 总部排序最优先
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .execute()
    }
    return hqDeptId
  }

  async getDepartments() {
    return this.db
      .select()
      .from(projects)
      .orderBy(
        projects.sortOrder, // 总部 sortOrder = 0，会排在最前面
        projects.name
      )
      .all()
  }

  async createDepartment(data: { name: string; hqId?: string; code?: string; sortOrder?: number }) {
    const existing = await this.db.query.projects.findFirst({
      where: eq(projects.name, data.name),
    })
    if (existing) {
      throw Errors.DUPLICATE('部门名称')
    }

    const id = uuid()
    // 如果未提供 hqId，尝试查找默认总部或创建一个
    let hqId = data.hqId
    if (!hqId) {
      const defaultHq = await this.db.query.headquarters.findFirst()
      if (defaultHq) {
        hqId = defaultHq.id
      } else {
        // 如果不存在，创建默认总部
        const newHqId = uuid()
        await this.db
          .insert(headquarters)
          .values({ id: newHqId, name: 'Default HQ', active: 1 })
          .execute()
        hqId = newHqId
      }
    }

    await this.db
      .insert(projects)
      .values({
        id,
        name: data.name,
        code: data.code || `PRJ-${id.substring(0, 8).toUpperCase()}`, // 确保 code 有值
        hqId,
        active: 1,
        sortOrder: data.sortOrder ?? 100, // 默认排序值，总部为 0
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    return { id, hqId, name: data.name }
  }

  async updateDepartment(id: string, data: { name?: string; hqId?: string; active?: number; sortOrder?: number }) {
    if (data.name) {
      const existing = await this.db.query.projects.findFirst({
        where: and(eq(projects.name, data.name), ne(projects.id, id)),
      })
      if (existing) {
        throw Errors.DUPLICATE('部门名称')
      }
    }

    const dept = await this.db.query.projects.findFirst({ where: eq(projects.id, id) })
    if (!dept) {
      throw Errors.NOT_FOUND('部门')
    }

    const updates: any = { updatedAt: Date.now() }
    if (data.name !== undefined) { updates.name = data.name }
    if (data.hqId !== undefined) { updates.hqId = data.hqId }
    if (data.active !== undefined) { updates.active = data.active }
    if (data.sortOrder !== undefined) { updates.sortOrder = data.sortOrder }

    await this.db.update(projects).set(updates).where(eq(projects.id, id)).execute()
    return { ok: true }
  }

  async deleteDepartment(id: string) {
    const dept = await this.db.query.projects.findFirst({ where: eq(projects.id, id) })
    if (!dept) {
      throw Errors.NOT_FOUND('部门')
    }

    // 检查依赖关系
    const siteCount = await this.db.$count(sites, eq(sites.departmentId, id))
    if (siteCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')
    }

    const employeeCount = await this.db.$count(
      schema.employees,
      eq(schema.employees.departmentId, id)
    )
    if (employeeCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有员工')
    }

    const orgDeptCount = await this.db.$count(
      schema.orgDepartments,
      eq(schema.orgDepartments.projectId, id)
    )
    if (orgDeptCount > 0) {
      throw Errors.BUSINESS_ERROR('无法删除，该项目下还有组织部门')
    }

    await this.db.delete(projects).where(eq(projects.id, id)).execute()
    return { ok: true, name: dept.name }
  }
}

