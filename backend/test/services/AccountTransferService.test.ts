import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { FinanceService } from '../../src/services/finance/FinanceService.js'
import { AccountTransferService } from '../../src/services/finance/AccountTransferService.js'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import {
  accounts,
  accountTransfers,
  categories,
  sites,
  projects,
  orgDepartments,
  employees,
  currencies,
} from '../../src/db/schema.js'
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

describe.skip('AccountTransferService', () => {
  let service: AccountTransferService
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
    financeService = new FinanceService(db)
    service = new AccountTransferService(db, financeService)

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
      .insert(projects)
      .values({
        id: departmentId,
        name: 'Test Project',
        code: 'PRJ1',
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
        projectId: departmentId,
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

  describe('Account Transfers', () => {
    it('should create an account transfer', async () => {
      const toAccountId = uuid()
      await db
        .insert(accounts)
        .values({
          id: toAccountId,
          name: 'To Account',
          currency: 'CNY',
          type: 'bank',
          openingCents: 0,
          active: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .execute()

      const result = await service.create({
        transferDate: '2023-01-02',
        fromAccountId: accountId,
        toAccountId: toAccountId,
        fromAmountCents: 5000,
        toAmountCents: 5000,
        memo: 'Test Transfer',
        createdBy: userId,
      })

      expect(result.id).toBeDefined()

      const transfer = await service.getById(result.id)
      expect(transfer).toBeDefined()
      expect(transfer?.transfer.fromAmountCents).toBe(5000)
    })
  })
})
