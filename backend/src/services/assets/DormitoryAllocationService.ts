/**
 * 宿舍分配服务
 * 处理宿舍分配和归还
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../../db/schema.js'
import {
  dormitoryAllocations,
  rentalProperties,
} from '../../db/schema.js'
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'

export class DormitoryAllocationService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async listAllocations(query: { propertyId?: string; employeeId?: string; returned?: boolean }) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN

    // 1. 查询分配记录
    const conditions = []
    if (query.propertyId) { conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId)) }
    if (query.employeeId) { conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId)) }
    if (query.returned === true) { conditions.push(isNotNull(dormitoryAllocations.returnDate)) }
    if (query.returned === false) { conditions.push(isNull(dormitoryAllocations.returnDate)) }

    const allocations = await this.db
      .select()
      .from(dormitoryAllocations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
      .execute()

    if (allocations.length === 0) return []

    // 2. 收集关联 ID
    const propertyIds = [...new Set(allocations.map(a => a.propertyId).filter(Boolean) as string[])]
    const employeeIds = [...new Set(allocations.map(a => a.employeeId).filter(Boolean) as string[])]
    const creatorIds = [...new Set(allocations.map(a => a.createdBy).filter(Boolean) as string[])]

    // 3. 批量查询关联数据
    const [properties, employees, creators] = await Promise.all([
      propertyIds.length > 0
        ? this.db.select({ id: rentalProperties.id, propertyCode: rentalProperties.propertyCode, name: rentalProperties.name })
          .from(rentalProperties).where(eq(rentalProperties.id, propertyIds[0])).execute()
          .then(async () => {
            // 使用简单的批量查询
            const results = []
            for (const id of propertyIds) {
              const p = await this.db.select({ id: rentalProperties.id, propertyCode: rentalProperties.propertyCode, name: rentalProperties.name })
                .from(rentalProperties).where(eq(rentalProperties.id, id)).get()
              if (p) results.push(p)
            }
            return results
          })
        : Promise.resolve([]),
      employeeIds.length > 0
        ? (async () => {
          const results = []
          for (const id of employeeIds) {
            const e = await this.db.select({ id: schema.employees.id, name: schema.employees.name, departmentId: schema.employees.departmentId })
              .from(schema.employees).where(eq(schema.employees.id, id)).get()
            if (e) results.push(e)
          }
          return results
        })()
        : Promise.resolve([]),
      creatorIds.length > 0
        ? (async () => {
          const results = []
          for (const id of creatorIds) {
            const c = await this.db.select({ id: schema.employees.id, name: schema.employees.name })
              .from(schema.employees).where(eq(schema.employees.id, id)).get()
            if (c) results.push(c)
          }
          return results
        })()
        : Promise.resolve([]),
    ])

    // 4. 查询部门信息
    const deptIds = [...new Set(employees.map(e => e.departmentId).filter(Boolean) as string[])]
    const departments = deptIds.length > 0
      ? await (async () => {
        const results = []
        for (const id of deptIds) {
          const d = await this.db.select({ id: schema.departments.id, name: schema.departments.name })
            .from(schema.departments).where(eq(schema.departments.id, id)).get()
          if (d) results.push(d)
        }
        return results
      })()
      : []

    // 5. 构建 Map
    const propertyMap = new Map(properties.map(p => [p.id, p]))
    const employeeMap = new Map(employees.map(e => [e.id, e]))
    const creatorMap = new Map(creators.map(c => [c.id, c]))
    const deptMap = new Map(departments.map(d => [d.id, d]))

    // 6. 组装结果
    return allocations.map(a => {
      const property = a.propertyId ? propertyMap.get(a.propertyId) : null
      const employee = a.employeeId ? employeeMap.get(a.employeeId) : null
      const creator = a.createdBy ? creatorMap.get(a.createdBy) : null
      const dept = employee?.departmentId ? deptMap.get(employee.departmentId) : null

      return {
        allocation: a,
        propertyCode: property?.propertyCode || null,
        propertyName: property?.name || null,
        employeeName: employee?.name || null,
        employeeDepartmentId: employee?.departmentId || null,
        employeeDepartmentName: dept?.name || null,
        createdByName: creator?.name || null,
      }
    })
  }

  async listAllocationsSimple(query: {
    propertyId?: string
    employeeId?: string
    returned?: boolean
  }) {
    // D1 兼容性修复：使用顺序查询代替复杂 JOIN
    const conditions = []
    if (query.propertyId) { conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId)) }
    if (query.employeeId) { conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId)) }
    if (query.returned === true) { conditions.push(isNotNull(dormitoryAllocations.returnDate)) }
    if (query.returned === false) { conditions.push(isNull(dormitoryAllocations.returnDate)) }

    const allocations = await this.db
      .select()
      .from(dormitoryAllocations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
      .execute()

    if (allocations.length === 0) return []

    // 收集并批量查询关联数据
    const propertyIds = [...new Set(allocations.map(a => a.propertyId).filter(Boolean) as string[])]
    const employeeIds = [...new Set(allocations.map(a => a.employeeId).filter(Boolean) as string[])]

    const properties: { id: string; propertyCode: string | null; name: string | null }[] = []
    for (const id of propertyIds) {
      const p = await this.db.select({ id: rentalProperties.id, propertyCode: rentalProperties.propertyCode, name: rentalProperties.name })
        .from(rentalProperties).where(eq(rentalProperties.id, id)).get()
      if (p) properties.push(p)
    }

    const employees: { id: string; name: string | null; departmentId: string | null }[] = []
    for (const id of employeeIds) {
      const e = await this.db.select({ id: schema.employees.id, name: schema.employees.name, departmentId: schema.employees.departmentId })
        .from(schema.employees).where(eq(schema.employees.id, id)).get()
      if (e) employees.push(e)
    }

    const deptIds = [...new Set(employees.map(e => e.departmentId).filter(Boolean) as string[])]
    const departments: { id: string; name: string | null }[] = []
    for (const id of deptIds) {
      const d = await this.db.select({ id: schema.departments.id, name: schema.departments.name })
        .from(schema.departments).where(eq(schema.departments.id, id)).get()
      if (d) departments.push(d)
    }

    const propertyMap = new Map(properties.map(p => [p.id, p]))
    const employeeMap = new Map(employees.map(e => [e.id, e]))
    const deptMap = new Map(departments.map(d => [d.id, d]))

    return allocations.map(a => {
      const property = a.propertyId ? propertyMap.get(a.propertyId) : null
      const employee = a.employeeId ? employeeMap.get(a.employeeId) : null
      const dept = employee?.departmentId ? deptMap.get(employee.departmentId) : null

      return {
        allocation: a,
        propertyCode: property?.propertyCode || null,
        propertyName: property?.name || null,
        employeeName: employee?.name || null,
        employeeDepartmentId: employee?.departmentId || null,
        employeeDepartmentName: dept?.name || null,
      }
    })
  }

  async allocateDormitory(data: {
    propertyId: string
    employeeId: string
    roomNumber?: string
    bedNumber?: string
    allocationDate: string
    monthlyRentCents?: number
    memo?: string
    createdBy?: string
  }) {
    const property = await this.db
      .select()
      .from(rentalProperties)
      .where(eq(rentalProperties.id, data.propertyId))
      .get()
    if (!property) {
      throw Errors.NOT_FOUND('物业')
    }
    if (property.propertyType !== 'dormitory') {
      throw Errors.BUSINESS_ERROR('该物业不是宿舍')
    }

    const employee = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, data.employeeId))
      .get()
    if (!employee) {
      throw Errors.NOT_FOUND('员工')
    }
    if (employee.active === 0) {
      throw Errors.BUSINESS_ERROR('员工已停用')
    }

    const existing = await this.db
      .select()
      .from(dormitoryAllocations)
      .where(
        and(
          eq(dormitoryAllocations.propertyId, data.propertyId),
          eq(dormitoryAllocations.employeeId, data.employeeId),
          isNull(dormitoryAllocations.returnDate)
        )
      )
      .get()
    if (existing) {
      throw Errors.DUPLICATE('员工已分配到该宿舍')
    }

    const id = uuid()
    const now = Date.now()

    await this.db
      .insert(dormitoryAllocations)
      .values({
        id,
        propertyId: data.propertyId,
        employeeId: data.employeeId,
        roomNumber: data.roomNumber,
        bedNumber: data.bedNumber,
        allocationDate: data.allocationDate,
        monthlyRentCents: data.monthlyRentCents,
        memo: data.memo,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return { id }
  }

  async returnDormitory(id: string, data: { returnDate: string; memo?: string }) {
    const allocation = await this.db
      .select()
      .from(dormitoryAllocations)
      .where(eq(dormitoryAllocations.id, id))
      .get()
    if (!allocation) {
      throw Errors.NOT_FOUND('分配记录')
    }
    if (allocation.returnDate) {
      throw Errors.BUSINESS_ERROR('已归还')
    }

    await this.db
      .update(dormitoryAllocations)
      .set({
        returnDate: data.returnDate,
        memo: data.memo || allocation.memo,
        updatedAt: Date.now(),
      })
      .where(eq(dormitoryAllocations.id, id))
      .execute()
  }
}

