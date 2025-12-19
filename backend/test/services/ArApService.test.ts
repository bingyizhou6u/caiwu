import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { FinanceService } from '../../src/services/finance/FinanceService.js'
import { ArApService } from '../../src/services/finance/ArApService.js'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import {
  accounts,
  categories,
  sites,
  departments,
  employees,
  currencies,
} from '../../src/db/schema'
import schemaSql from '../../src/db/schema.sql?raw'

async function applySchema(db: any) {
  const statements = schemaSql.split(';').filter(s => s.trim())
  for (const statement of statements) {
    try {
      await db.prepare(statement).run()
    } catch (e) {
      console.error('Failed to execute statement:', statement)
      throw e
    }
  }
}

describe('ArApService', () => {
  let service: ArApService
  let financeService: FinanceService
  let db: any
  let accountId: string
  let categoryId: string
  let siteId: string
  let departmentId: string
  let userId: string

  beforeAll(async () => {
    const rawDb = env.DB
    await applySchema(rawDb)
    db = createDb(rawDb)
    // Mock transaction to bypass D1 emulator limitation in tests
    // @ts-ignore
    db.transaction = async cb => cb(db)

    financeService = new FinanceService(db)
    service = new ArApService(db, financeService)

    // Setup master data
    accountId = uuid()
    await db
      .insert(accounts)
      .values({
        id: accountId,
        name: 'Test Account',
        currency: 'CNY',
        type: 'bank',
        openingCents: 100000,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    categoryId = uuid()
    await db
      .insert(categories)
      .values({
        id: categoryId,
        name: 'Test Category',
        kind: 'expense',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    departmentId = uuid()
    await db
      .insert(departments)
      .values({
        id: departmentId,
        name: 'Test Department',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    siteId = uuid()
    await db
      .insert(sites)
      .values({
        id: siteId,
        name: 'Test Site',
        siteCode: 'TS001',
        departmentId,
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    userId = uuid()
    await db
      .insert(employees)
      .values({
        id: userId,
        email: 'test@example.com',
        name: 'User',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()

    await db
      .insert(currencies)
      .values({
        code: 'CNY',
        name: 'Chinese Yuan',
        symbol: '¥',
        active: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .execute()
  })

  describe('AR/AP Docs', () => {
    it('should create an AR doc', async () => {
      const result = await service.create({
        kind: 'AR',
        amountCents: 2000,
        issueDate: '2023-01-03',
        memo: 'Test AR',
        siteId,
      })

      expect(result.id).toBeDefined()
      expect(result.docNo).toMatch(/^AR20230103-\d{3}$/)
    })

    it('should confirm an AR doc', async () => {
      const { id: docId } = await service.create({
        kind: 'AR',
        amountCents: 3000,
        issueDate: '2023-01-04',
        memo: 'Test AR Confirm',
      })

      const result = await service.confirm({
        docId,
        accountId,
        bizDate: '2023-01-05',
        memo: 'Confirm AR',
        createdBy: userId,
      })

      expect(result.ok).toBe(true)
      expect(result.flowId).toBeDefined()
    })
  })
})
