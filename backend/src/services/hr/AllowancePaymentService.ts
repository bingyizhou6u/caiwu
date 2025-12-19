import { eq, and, desc, sql } from 'drizzle-orm'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { employees } from '../../db/schema.js'
import * as schema from '../../db/schema.js'
import { v4 as uuid } from 'uuid'
import { Errors } from '../../utils/errors.js'
import { alias } from 'drizzle-orm/sqlite-core'
import { query as dbQuery } from '../../utils/query-helpers.js'

export class AllowancePaymentService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  async list(query: {
    year?: number
    month?: number
    employeeId?: string
    allowanceType?: string
  }) {
    const conditions = []
    if (query.year) { conditions.push(eq(schema.allowancePayments.year, query.year)) }
    if (query.month) { conditions.push(eq(schema.allowancePayments.month, query.month)) }
    if (query.employeeId) { conditions.push(eq(schema.allowancePayments.employeeId, query.employeeId)) }
    if (query.allowanceType) { conditions.push(eq(schema.allowancePayments.allowanceType, query.allowanceType)) }

    const creator = alias(employees, 'creator')

    return await this.db
      .select({
        payment: schema.allowancePayments,
        employeeName: employees.name,
        departmentName: schema.departments.name,
        currencyName: schema.currencies.name,
        createdByName: creator.email, // Keeping email as per original, though name might be better
      })
      .from(schema.allowancePayments)
      .leftJoin(employees, eq(employees.id, schema.allowancePayments.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, employees.departmentId))
      .leftJoin(schema.currencies, eq(schema.currencies.code, schema.allowancePayments.currencyId))
      .leftJoin(creator, eq(creator.id, schema.allowancePayments.createdBy))
      .where(and(...conditions))
      .orderBy(
        desc(schema.allowancePayments.year),
        desc(schema.allowancePayments.month),
        employees.name
      )
      .execute()
  }

  async create(data: {
    employeeId: string
    year: number
    month: number
    allowanceType: string
    currencyId: string
    amountCents: number
    paymentDate: string
    paymentMethod?: string
    voucherUrl?: string
    memo?: string
    createdBy?: string
  }) {
    // 检查重复
    const existing = await this.db
      .select()
      .from(schema.allowancePayments)
      .where(
        and(
          eq(schema.allowancePayments.employeeId, data.employeeId),
          eq(schema.allowancePayments.year, data.year),
          eq(schema.allowancePayments.month, data.month),
          eq(schema.allowancePayments.allowanceType, data.allowanceType),
          eq(schema.allowancePayments.currencyId, data.currencyId)
        )
      )
      .get()

    if (existing) {
      throw Errors.DUPLICATE('津贴支付记录')
    }

    const id = uuid()
    const now = Date.now()
    await this.db
      .insert(schema.allowancePayments)
      .values({
        id,
        ...data,
        paymentMethod: data.paymentMethod || 'cash',
        createdAt: now,
        updatedAt: now,
      })
      .execute()

    return await this.get(id)
  }

  async update(
    id: string,
    data: {
      amountCents?: number
      paymentDate?: string
      paymentMethod?: string
      voucherUrl?: string
      memo?: string
    }
  ) {
    const now = Date.now()
    await this.db
      .update(schema.allowancePayments)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(schema.allowancePayments.id, id))
      .execute()

    return await this.get(id)
  }

  async delete(id: string) {
    const payment = await this.db
      .select()
      .from(schema.allowancePayments)
      .where(eq(schema.allowancePayments.id, id))
      .get()
    if (!payment) { return null }

    await this.db
      .delete(schema.allowancePayments)
      .where(eq(schema.allowancePayments.id, id))
      .execute()
    return payment
  }

  async get(id: string) {
    const creator = alias(employees, 'creator')

    return await this.db
      .select({
        payment: schema.allowancePayments,
        employeeName: employees.name,
        departmentName: schema.departments.name,
        currencyName: schema.currencies.name,
        createdByName: creator.email,
      })
      .from(schema.allowancePayments)
      .leftJoin(employees, eq(employees.id, schema.allowancePayments.employeeId))
      .leftJoin(schema.departments, eq(schema.departments.id, employees.departmentId))
      .leftJoin(schema.currencies, eq(schema.currencies.code, schema.allowancePayments.currencyId))
      .leftJoin(creator, eq(creator.id, schema.allowancePayments.createdBy))
      .where(eq(schema.allowancePayments.id, id))
      .get()
  }

  async generate(year: number, month: number, paymentDate: string, userId: string) {
    // 1. 获取在职员工 - 使用性能监控
    const activeEmployees = await dbQuery(
      this.db,
      'AllowancePaymentService.generate.getActiveEmployees',
      () => this.db
        .select()
        .from(employees)
        .where(eq(employees.active, 1))
        .all(),
      undefined
    )

    // 2. 获取所有津贴 - 使用性能监控
    const allAllowances = await dbQuery(
      this.db,
      'AllowancePaymentService.generate.getAllAllowances',
      () => this.db.select().from(schema.employeeAllowances).all(),
      undefined
    )
    const allowancesMap = new Map<string, typeof allAllowances>()
    allAllowances.forEach(a => {
      if (!allowancesMap.has(a.employeeId)) { allowancesMap.set(a.employeeId, []) }
      allowancesMap.get(a.employeeId)!.push(a)
    })

    // 3. 获取现有支付记录
    const existingPayments = await this.db
      .select()
      .from(schema.allowancePayments)
      .where(
        and(eq(schema.allowancePayments.year, year), eq(schema.allowancePayments.month, month))
      )
      .execute()

    const existingSet = new Set(
      existingPayments.map(
        p => `${p.employeeId}:${p.year}:${p.month}:${p.allowanceType}:${p.currencyId}`
      )
    )

    const createdIds: string[] = []
    const now = Date.now()

    for (const emp of activeEmployees) {
      const joinDate = new Date(emp.joinDate + 'T00:00:00Z')
      const joinYear = joinDate.getFullYear()
      const joinMonth = joinDate.getMonth() + 1

      if (joinYear > year || (joinYear === year && joinMonth > month)) { continue }

      const empAllowances = allowancesMap.get(emp.id) || []

      for (const allowance of empAllowances) {
        if (allowance.allowanceType === 'birthday') {
          if (!emp.birthday) { continue }
          const birthday = new Date(emp.birthday + 'T00:00:00Z')
          if (birthday.getMonth() + 1 !== month) { continue }
        }

        const key = `${emp.id}:${year}:${month}:${allowance.allowanceType}:${allowance.currencyId}`
        if (existingSet.has(key)) { continue }

        const id = uuid()
        await this.db
          .insert(schema.allowancePayments)
          .values({
            id,
            employeeId: emp.id,
            year,
            month,
            allowanceType: allowance.allowanceType,
            currencyId: allowance.currencyId,
            amountCents: allowance.amountCents,
            paymentDate,
            paymentMethod: 'cash',
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          })
          .execute()
        createdIds.push(id)
      }
    }

    return { created: createdIds.length, ids: createdIds }
  }
  async getEmployeeYearlyStats(employeeId: string, year: number) {
    const allowances = await this.db
      .select()
      .from(schema.allowancePayments)
      .where(
        and(
          eq(schema.allowancePayments.employeeId, employeeId),
          eq(schema.allowancePayments.year, year)
        )
      )
      .orderBy(
        desc(schema.allowancePayments.year),
        desc(schema.allowancePayments.month),
        desc(schema.allowancePayments.allowanceType)
      )
      .execute()

    const monthlyStats = await this.db
      .select({
        year: schema.allowancePayments.year,
        month: schema.allowancePayments.month,
        totalCents: sql<number>`COALESCE(SUM(${schema.allowancePayments.amountCents}), 0)`,
      })
      .from(schema.allowancePayments)
      .where(
        and(
          eq(schema.allowancePayments.employeeId, employeeId),
          eq(schema.allowancePayments.year, year)
        )
      )
      .groupBy(schema.allowancePayments.year, schema.allowancePayments.month)
      .orderBy(desc(schema.allowancePayments.month))
      .execute()

    return { allowances, monthlyStats }
  }
}
