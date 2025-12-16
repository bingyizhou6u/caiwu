/**
 * 宿舍分配服务
 * 处理宿舍分配和归还
 */

import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import {
  dormitoryAllocations,
  rentalProperties,
} from '../db/schema.js'
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'

export class DormitoryAllocationService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  async listAllocations(query: { propertyId?: string; employeeId?: string; returned?: boolean }) {
    const conditions = []
    if (query.propertyId) {conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId))}
    if (query.employeeId) {conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId))}
    if (query.returned === true)
      {conditions.push(isNotNull(dormitoryAllocations.returnDate))}
    if (query.returned === false) {conditions.push(isNull(dormitoryAllocations.returnDate))}

    const creator = alias(schema.employees, 'creator')

    return await this.db
      .select({
        allocation: dormitoryAllocations,
        propertyCode: rentalProperties.propertyCode,
        propertyName: rentalProperties.name,
        employeeName: schema.employees.name,
        employeeDepartmentId: schema.employees.departmentId,
        employeeDepartmentName: schema.departments.name,
        createdByName: creator.name,
      })
      .from(dormitoryAllocations)
      .leftJoin(rentalProperties, eq(rentalProperties.id, dormitoryAllocations.propertyId))
      .leftJoin(schema.employees, eq(schema.employees.id, dormitoryAllocations.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
      .leftJoin(creator, eq(creator.id, dormitoryAllocations.createdBy))
      .where(and(...conditions))
      .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
      .execute()
  }

  async listAllocationsSimple(query: {
    propertyId?: string
    employeeId?: string
    returned?: boolean
  }) {
    const conditions = []
    if (query.propertyId) {conditions.push(eq(dormitoryAllocations.propertyId, query.propertyId))}
    if (query.employeeId) {conditions.push(eq(dormitoryAllocations.employeeId, query.employeeId))}
    if (query.returned === true)
      {conditions.push(isNotNull(dormitoryAllocations.returnDate))}
    if (query.returned === false) {conditions.push(isNull(dormitoryAllocations.returnDate))}

    return await this.db
      .select({
        allocation: dormitoryAllocations,
        propertyCode: rentalProperties.propertyCode,
        propertyName: rentalProperties.name,
        employeeName: schema.employees.name,
        employeeDepartmentId: schema.employees.departmentId,
        employeeDepartmentName: schema.departments.name,
      })
      .from(dormitoryAllocations)
      .leftJoin(rentalProperties, eq(rentalProperties.id, dormitoryAllocations.propertyId))
      .leftJoin(schema.employees, eq(schema.employees.id, dormitoryAllocations.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, schema.employees.departmentId))
      .where(and(...conditions))
      .orderBy(desc(dormitoryAllocations.allocationDate), desc(dormitoryAllocations.createdAt))
      .execute()
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
    if (!property) {throw Errors.NOT_FOUND('物业')}
    if (property.propertyType !== 'dormitory') {throw Errors.BUSINESS_ERROR('该物业不是宿舍')}

    const employee = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, data.employeeId))
      .get()
    if (!employee) {throw Errors.NOT_FOUND('员工')}
    if (employee.active === 0) {throw Errors.BUSINESS_ERROR('员工已停用')}

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
    if (existing) {throw Errors.DUPLICATE('员工已分配到该宿舍')}

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
    if (!allocation) {throw Errors.NOT_FOUND('分配记录')}
    if (allocation.returnDate) {throw Errors.BUSINESS_ERROR('已归还')}

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

