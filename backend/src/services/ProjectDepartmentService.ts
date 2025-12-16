/**
 * 项目部门管理服务
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { departments, sites, headquarters } from '../db/schema.js'
import { eq, and, ne } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'

export class ProjectDepartmentService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async getDepartments() {
    return this.db.select().from(departments).all()
  }

  async createDepartment(data: { name: string; hqId?: string; code?: string }) {
    const existing = await this.db.query.departments.findFirst({
      where: eq(departments.name, data.name),
    })
    if (existing) {throw Errors.DUPLICATE('部门名称')}

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
      .insert(departments)
      .values({
        id,
        name: data.name,
        hqId,
        code: data.code,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    return { id, hqId, name: data.name }
  }

  async updateDepartment(id: string, data: { name?: string; hqId?: string; active?: number }) {
    if (data.name) {
      const existing = await this.db.query.departments.findFirst({
        where: and(eq(departments.name, data.name), ne(departments.id, id)),
      })
      if (existing) {throw Errors.DUPLICATE('部门名称')}
    }

    const dept = await this.db.query.departments.findFirst({ where: eq(departments.id, id) })
    if (!dept) {throw Errors.NOT_FOUND('部门')}

    const updates: any = { updatedAt: Date.now() }
    if (data.name !== undefined) {updates.name = data.name}
    if (data.hqId !== undefined) {updates.hqId = data.hqId}
    if (data.active !== undefined) {updates.active = data.active}

    await this.db.update(departments).set(updates).where(eq(departments.id, id)).execute()
    return { ok: true }
  }

  async deleteDepartment(id: string) {
    const dept = await this.db.query.departments.findFirst({ where: eq(departments.id, id) })
    if (!dept) {throw Errors.NOT_FOUND('部门')}

    // 检查依赖关系
    const siteCount = await this.db.$count(sites, eq(sites.departmentId, id))
    if (siteCount > 0) {throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')}

    const employeeCount = await this.db.$count(
      schema.employees,
      eq(schema.employees.departmentId, id)
    )
    if (employeeCount > 0) {throw Errors.BUSINESS_ERROR('无法删除，该项目下还有员工')}

    const orgDeptCount = await this.db.$count(
      schema.orgDepartments,
      eq(schema.orgDepartments.projectId, id)
    )
    if (orgDeptCount > 0) {throw Errors.BUSINESS_ERROR('无法删除，该项目下还有组织部门')}

    await this.db.delete(departments).where(eq(departments.id, id)).execute()
    return { ok: true, name: dept.name }
  }
}

