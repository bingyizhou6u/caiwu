import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { env } from 'cloudflare:test'
import { FinanceService } from '../../src/services/finance/FinanceService.js'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import {
  accounts,
  categories,
  sites,
  departments,
  employees,
  currencies,
  accountTransactions,
} from '../../src/db/schema'
import { eq } from 'drizzle-orm'
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

describe('FinanceService', () => {
  let service: FinanceService
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
    service = new FinanceService(db)

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
      .insert(employees)
      .values({
        email: 'test2@example.com',
        name: 'Test User',
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

  describe('Cash Flows', () => {
    it('should create a cash flow', async () => {
      const result = await service.createCashFlow({
        bizDate: '2023-01-01',
        type: 'expense',
        accountId,
        amountCents: 1000,
        categoryId,
        siteId,
        departmentId,
        memo: 'Test Expense',
        createdBy: userId,
      })

      expect(result.id).toBeDefined()
      expect(result.voucherNo).toBeDefined()
      expect(result.voucherNo).toMatch(/^JZ20230101-\d{3}$/)
    })

    it('should get next voucher no', async () => {
      const voucherNo = await service.getNextVoucherNo('2023-01-01')
      expect(voucherNo).toMatch(/^JZ20230101-\d{3}$/)
    })
  })

  describe('Balance Calculation', () => {
    it('should handle backdated transactions (snapshot behavior)', async () => {
      // 1. Create Initial Transaction (T1) on 2023-01-10
      const t1 = await service.createCashFlow({
        bizDate: '2023-01-10',
        type: 'income',
        accountId,
        amountCents: 1000,
        createdBy: userId,
      })

      // 2. Create Future Transaction (T2) on 2023-01-20
      const t2 = await service.createCashFlow({
        bizDate: '2023-01-20',
        type: 'income',
        accountId,
        amountCents: 2000,
        createdBy: userId,
      })

      // 3. Backdate Transaction (T3) on 2023-01-15 (Between T1 and T2)
      const t3 = await service.createCashFlow({
        bizDate: '2023-01-15',
        type: 'income',
        accountId,
        amountCents: 500,
        createdBy: userId,
      })

      // Verify Balances
      // T1 Balance: Opening(100000) + 1000 = 101000
      // T2 Balance: T1_Balance(101000) + 2000 = 103000 (Calculated at creation time)
      // T3 Balance: T1_Balance(101000) + 500 = 101500 (Calculated at creation time, finding T1 as last before)

      // Fetch transaction records to verify snapshots
      const txs = await db
        .select()
        .from(accountTransactions)
        .where(eq(accountTransactions.accountId, accountId))
        .orderBy(accountTransactions.transactionDate)
        .execute()

      // Note: DB returns all. Let's find by flowId
      const tx1 = txs.find((t: any) => t.flowId === t1.id)
      const tx2 = txs.find((t: any) => t.flowId === t2.id)
      const tx3 = txs.find((t: any) => t.flowId === t3.id)

      expect(tx1.balanceAfterCents).toBe(101000)
      expect(tx2.balanceAfterCents).toBe(103000) // T2 is NOT recalculated
      expect(tx3.balanceAfterCents).toBe(101500) // T3 is based on T1
    })
  })
})
