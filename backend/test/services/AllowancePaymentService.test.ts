import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { AllowancePaymentService } from '../../src/services/AllowancePaymentService'
import schemaSql from '../../src/db/schema.sql?raw'
import * as schema from '../../src/db/schema'
import { createDb } from '../../src/utils/db'
import { v4 as uuid } from 'uuid'

describe('AllowancePaymentService', () => {
  let service: AllowancePaymentService
  let db: any

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter((s: string) => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = createDb(env.DB)
    service = new AllowancePaymentService(db)
  })

  beforeEach(async () => {
    await db.delete(schema.allowancePayments).execute()
    await db.delete(schema.employeeAllowances).execute()
    await db.delete(schema.employees).execute()
    await db.delete(schema.currencies).execute()
  })

  it('should create and get allowance payment', async () => {
    const empId = uuid()
    await db
      .insert(schema.employees)
      .values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' })
      .execute()
    await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute()

    const created = await service.create({
      employeeId: empId,
      year: 2023,
      month: 1,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 50000,
      paymentDate: '2023-01-31',
    })

    expect(created).toBeDefined()
    expect(created?.payment.amountCents).toBe(50000)
    expect(created?.employeeName).toBe('Emp 1')

    const fetched = await service.get(created!.payment.id)
    expect(fetched?.payment.id).toBe(created!.payment.id)
  })

  it('should list payments with filters', async () => {
    const empId = uuid()
    await db
      .insert(schema.employees)
      .values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' })
      .execute()
    await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute()

    await service.create({
      employeeId: empId,
      year: 2023,
      month: 1,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 500,
      paymentDate: '2023-01-31',
    })
    await service.create({
      employeeId: empId,
      year: 2023,
      month: 2,
      allowanceType: 'transport',
      currencyId: 'CNY',
      amountCents: 300,
      paymentDate: '2023-02-28',
    })

    const listAll = await service.list({})
    expect(listAll.length).toBe(2)

    const listJan = await service.list({ year: 2023, month: 1 })
    expect(listJan.length).toBe(1)
    expect(listJan[0].payment.allowanceType).toBe('meal')

    const listTransport = await service.list({ allowanceType: 'transport' })
    expect(listTransport.length).toBe(1)
  })

  it('should generate payments based on rules', async () => {
    const userId = uuid()
    const empId = uuid()
    await db
      .insert(schema.employees)
      .values({
        id: empId,
        name: 'Emp 1',
        active: 1,
        email: 'e1@test.com',
        joinDate: '2022-01-01',
        birthday: '1990-05-15',
      })
      .execute()
    await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute()

    // Rules
    await db
      .insert(schema.employeeAllowances)
      .values({
        id: uuid(),
        employeeId: empId,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 500,
        createdAt: 0,
        updatedAt: 0,
      })
      .execute()

    // Birthday rule
    await db
      .insert(schema.employeeAllowances)
      .values({
        id: uuid(),
        employeeId: empId,
        allowanceType: 'birthday',
        currencyId: 'CNY',
        amountCents: 1000,
        createdAt: 0,
        updatedAt: 0,
      })
      .execute()

    // Generate for regular month
    const gen1 = await service.generate(2023, 1, '2023-01-31', userId)
    expect(gen1.created).toBe(1) // Only meal
    // Check contents
    const list1 = await service.list({ year: 2023, month: 1 })
    expect(list1[0].payment.allowanceType).toBe('meal')

    // Generate for birthday month (May)
    const gen2 = await service.generate(2023, 5, '2023-05-31', userId)
    expect(gen2.created).toBe(2) // Meal + Birthday
    const list2 = await service.list({ year: 2023, month: 5 })
    expect(list2.find(p => p.payment.allowanceType === 'birthday')).toBeDefined()
  })

  it('should update and delete payment', async () => {
    const empId = uuid()
    await db
      .insert(schema.employees)
      .values({ id: empId, name: 'Emp 1', active: 1, email: 'e1@test.com' })
      .execute()
    await db.insert(schema.currencies).values({ code: 'CNY', name: 'Yuan', active: 1 }).execute()

    const created = await service.create({
      employeeId: empId,
      year: 2023,
      month: 1,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 500,
      paymentDate: '2023-01-31',
    })

    const updated = await service.update(created!.payment.id, { amountCents: 600 })
    expect(updated?.payment.amountCents).toBe(600)

    const deleted = await service.delete(created!.payment.id)
    expect(deleted).toBeDefined()

    const fetched = await service.get(created!.payment.id)
    expect(fetched).toBeUndefined()
  })
})
