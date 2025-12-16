import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema.js'
import { employees, currencies, employeeSalaries } from '../../src/db/schema.js'
import { SalaryService } from '../../src/services/SalaryService.js'
import { v4 as uuid } from 'uuid'
import schemaSql from '../../src/db/schema.sql?raw'

describe('SalaryService', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let service: SalaryService

  beforeAll(async () => {
    const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
    for (const statement of statements) {
      await env.DB.prepare(statement).run()
    }
    db = drizzle(env.DB, { schema })
    service = new SalaryService(db)
  })

  beforeEach(async () => {
    await db.delete(employeeSalaries).execute()
    await db.delete(employees).execute()
    await db.delete(currencies).execute()
  })

  const createEmployee = async (name: string) => {
    const id = uuid()
    await db
      .insert(employees)
      .values({
        id,
        name,
        email: `${name}@test.com`, // Add required email
        personalEmail: `${name}@test.com`, // Add required personalEmail
      })
      .execute()
    return id
  }

  const createCurrency = async (code: string, name: string) => {
    await db
      .insert(currencies)
      .values({
        code,
        name,
        symbol: '$',
      })
      .execute()
  }

  it('should create a salary record', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')

    const salary = await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 500000, // $5000
    })

    expect(salary).toBeDefined()
    expect(salary?.salary.amountCents).toBe(500000)
    expect(salary?.salary.currencyId).toBe('USD')
    expect(salary?.salary.salaryType).toBe('regular')
  })

  it('should update a salary record', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')

    const created = await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 500000,
    })

    const updated = await service.update(created!.salary.id, {
      amountCents: 600000,
    })

    expect(updated).toBeDefined()
    expect(updated?.salary.amountCents).toBe(600000)
  })

  it('should delete a salary record', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')

    const created = await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 500000,
    })

    const deleted = await service.delete(created!.salary.id)
    expect(deleted).toBeDefined()

    const found = await service.get(created!.salary.id)
    expect(found).toBeUndefined()
  })

  it('should list salary records', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')
    await createCurrency('CNY', 'Chinese Yuan')

    await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 500000,
    })

    await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'CNY',
      amountCents: 100000,
    })

    const list = await service.list(employeeId, 'regular')
    expect(list.length).toBe(2)
  })

  it('should batch update salary records', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')
    await createCurrency('CNY', 'Chinese Yuan')

    // Initial setup
    await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 500000,
    })

    // Batch update: Replace with new values (one updated, one new)
    const newSalaries = [
      { currencyId: 'USD', amountCents: 550000 },
      { currencyId: 'CNY', amountCents: 200000 },
    ]

    const updatedList = await service.batchUpdate(employeeId, 'regular', newSalaries)
    expect(updatedList.length).toBe(2)

    const usdSalary = updatedList.find(s => s.salary.currencyId === 'USD')
    const cnySalary = updatedList.find(s => s.salary.currencyId === 'CNY')

    expect(usdSalary?.salary.amountCents).toBe(550000)
    expect(cnySalary?.salary.amountCents).toBe(200000)
  })

  it('should calculate employee total salary', async () => {
    const employeeId = await createEmployee('John')
    await createCurrency('USD', 'US Dollar')

    await service.create({
      employeeId,
      salaryType: 'regular',
      currencyId: 'USD',
      amountCents: 100000,
    })

    await service.create({
      employeeId,
      salaryType: 'bonus',
      currencyId: 'USD',
      amountCents: 50000,
    })

    const totals = await service.getEmployeeTotalSalary(employeeId)
    expect(totals).toHaveLength(1)
    expect(totals[0].currencyId).toBe('USD')
    expect(totals[0].totalCents).toBe(150000)
  })
})
