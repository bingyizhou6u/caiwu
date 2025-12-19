import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { env } from 'cloudflare:test'
import { BorrowingService } from '../../src/services/finance/BorrowingService.js'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import { accounts, employees, borrowings, repayments, currencies } from '../../src/db/schema'
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

describe('BorrowingService', () => {
  let service: BorrowingService
  let db: any
  let accountId: string
  let userId: string

  beforeAll(async () => {
    const rawDb = env.DB
    await applySchema(rawDb)
    db = createDb(env.DB)
    // Mock transaction to bypass D1 emulator limitation in tests
    // @ts-ignore
    db.transaction = async cb => cb(db)

    service = new BorrowingService(db)

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

  describe('Borrowings', () => {
    it('should create a borrowing', async () => {
      const result = await service.createBorrowing({
        userId,
        accountId,
        amountCents: 50000,
        currency: 'CNY',
        borrowDate: '2023-01-06',
        memo: 'Test Borrowing',
        createdBy: userId,
      })

      expect(result.id).toBeDefined()

      const fetched = await service.getBorrowingById(result.id)
      expect(fetched).toBeDefined()
      expect(fetched?.amountCents).toBe(50000)
    })

    it('should create a repayment', async () => {
      const { id: borrowingId } = await service.createBorrowing({
        userId,
        accountId,
        amountCents: 10000,
        currency: 'CNY',
        borrowDate: '2023-01-07',
        memo: 'Test Borrowing for Repay',
      })

      const result = await service.createRepayment({
        borrowingId,
        accountId,
        amountCents: 5000,
        currency: 'CNY',
        repayDate: '2023-01-08',
        memo: 'Test Repayment',
        createdBy: userId,
      })

      expect(result.id).toBeDefined()

      const fetched = await service.getRepaymentById(result.id)
      expect(fetched).toBeDefined()
      expect(fetched?.amountCents).toBe(5000)
    })

    it('should get employee borrowings stats', async () => {
      const statsUser = uuid()
      await db
        .insert(employees)
        .values({
          id: statsUser,
          email: 'stats@example.com',
          name: 'Stats User',
          active: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .execute()

      // Create borrowing
      const { id: borrowingId } = await service.createBorrowing({
        userId: statsUser,
        accountId,
        amountCents: 20000,
        currency: 'CNY',
        borrowDate: '2023-01-09',
        memo: 'Stats Borrowing',
      })

      await service.createRepayment({
        borrowingId,
        accountId,
        amountCents: 5000,
        currency: 'CNY',
        repayDate: '2023-01-10',
        memo: 'Stats Repayment',
        createdBy: userId,
      })

      const stats = await service.getEmployeeBorrowings(statsUser)

      expect(stats.stats.totalBorrowedCents).toBe(20000)
      expect(stats.stats.totalRepaidCents).toBe(5000)
      expect(stats.stats.balanceCents).toBe(15000)
      expect(stats.borrowings.length).toBe(1)
    })

    it('should get borrowing balances report', async () => {
      const reportUser = uuid()
      await db
        .insert(employees)
        .values({
          id: reportUser,
          email: 'report@example.com',
          name: 'Report User',
          active: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .execute()

      await service.createBorrowing({
        userId: reportUser,
        accountId,
        amountCents: 30000,
        currency: 'CNY',
        borrowDate: '2023-01-11',
        memo: 'Report Borrowing',
      })

      const report = await service.getBorrowingBalances()
      expect(report.length).toBeGreaterThan(0)
      const userReport = report.find(r => r.userId === reportUser)
      expect(userReport).toBeDefined()
      expect(userReport?.balance_cents).toBe(30000)
    })
  })
})
