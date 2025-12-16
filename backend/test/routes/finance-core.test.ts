import { describe, it, expect, beforeAll, vi } from 'vitest'
import app from '../../src/index'
import { env } from 'cloudflare:test'
import { createDb } from '../../src/db/index'
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
import { FinanceService } from '../../src/services/FinanceService'
import { AuthService } from '../../src/services/AuthService'
import { MasterDataService } from '../../src/services/MasterDataService'
import { SalaryPaymentService } from '../../src/services/SalaryPaymentService'
import { ArApService } from '../../src/services/ArApService'
import { BorrowingService } from '../../src/services/BorrowingService'
import { SiteBillService } from '../../src/services/SiteBillService'
import { AccountTransferService } from '../../src/services/AccountTransferService'

// Mock permissions
vi.mock('../../src/utils/permissions', async () => {
  const actual = await vi.importActual<any>('../../src/utils/permissions')
  return {
    ...actual,
    hasPermission: () => true,
    getDataAccessFilter: () => ({ where: '1=1', binds: [] }),
    getUserEmployee: () => ({ id: 'emp-1', name: 'Test User' }),
  }
})

// Mock middleware
vi.mock('../../src/middleware', async () => {
  return {
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', '550e8400-e29b-41d4-a716-446655440000')
      await next()
    },
  }
})

// Mock audit
vi.mock('../../src/utils/audit', () => ({
  logAudit: vi.fn(),
  logAuditAction: vi.fn(),
}))

// Mock createDb in db/index to inject transaction mock globally for DI
vi.mock('../../src/db/index', async () => {
  const actual = await vi.importActual<any>('../../src/db/index')
  return {
    ...actual,
    createDb: (d1: any) => {
      const db = actual.createDb(d1)
      // Mock transaction to bypass D1 emulator limitation in tests
      // @ts-ignore
      db.transaction = async cb => cb(db)
      return db
    },
  }
})

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

describe('Finance Core Routes', () => {
  let db: any
  let accountId: string
  let categoryId: string
  let siteId: string
  let departmentId: string
  let userId: string
  let token: string = 'mock-token'

  beforeAll(async () => {
    const rawDb = env.DB
    await applySchema(rawDb)
    db = createDb(rawDb)

    // Setup services
    const mockSystemConfigService = { get: async () => ({ value: 'false' }) } as any
    const mockAuditService = { log: async () => {} } as any
    const mockEmailService = {
      sendActivationEmail: vi.fn(),
      sendLoginNotificationEmail: vi.fn(),
      sendPasswordResetLinkEmail: vi.fn(),
      sendPasswordChangedNotificationEmail: vi.fn(),
      sendTotpResetEmail: vi.fn(),
      sendEmail: vi.fn(),
    } as any
    const authService = new AuthService(
      db,
      env.SESSIONS_KV,
      mockSystemConfigService,
      mockAuditService,
      mockEmailService
    )
    const masterDataService = new MasterDataService(db)
    const financeService = new FinanceService(db)
    const salaryPaymentService = new SalaryPaymentService(db)
    const arApService = new ArApService(db, financeService)
    const borrowingService = new BorrowingService(db)
    const siteBillService = new SiteBillService(db)
    const accountTransferService = new AccountTransferService(db, financeService)

    // Inject services into app
    app.use('*', async (c, next) => {
      c.set('services', {
        auth: authService,
        masterData: masterDataService,
        finance: financeService,
        salaryPayment: salaryPaymentService,
        arAp: arApService,
        borrowing: borrowingService,
        siteBill: siteBillService,
        accountTransfer: accountTransferService,
      } as any)
      c.set('userId', '550e8400-e29b-41d4-a716-446655440000')
      await next()
    })

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

    userId = '550e8400-e29b-41d4-a716-446655440000'
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
        name: 'Test User 2',
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

  describe('POST /api/v2/flows', () => {
    it('should create a cash flow', async () => {
      const res = await app.request(
        '/api/v2/flows',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bizDate: '2023-01-01',
            type: 'expense',
            accountId: accountId,
            amountCents: 1000,
            categoryId: categoryId,
            siteId: siteId,
            departmentId: departmentId,
            memo: 'Test Expense',
            voucherUrls: ['http://example.com/voucher.jpg'],
          }),
        },
        {
          DB: env.DB,
          SESSIONS_KV: env.SESSIONS_KV,
          AUTH_JWT_SECRET: 'secret',
        } as any
      )

      const response = (await res.json()) as any
      expect(res.status).toBe(200)
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.id).toBeDefined()
      expect(response.data.voucherNo).toMatch(/^JZ20230101-\d{3}$/)
    })
  })

  describe('POST /api/v2/account-transfers', () => {
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

      const res = await app.request(
        '/api/v2/account-transfers',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            transferDate: '2023-01-02',
            fromAccountId: accountId,
            toAccountId: toAccountId,
            fromAmountCents: 5000,
            toAmountCents: 5000,
            memo: 'Test Transfer',
          }),
        },
        {
          DB: env.DB,
          SESSIONS_KV: env.SESSIONS_KV,
          AUTH_JWT_SECRET: 'secret',
        } as any
      )

      const response = (await res.json()) as any
      expect(res.status).toBe(200)
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.id).toBeDefined()
    })
  })

  describe('POST /api/v2/ar-ap/docs', () => {
    it('should create an AR doc', async () => {
      const res = await app.request(
        '/api/v2/ar-ap/docs',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            kind: 'AR',
            amountCents: 2000,
            issueDate: '2023-01-03',
            memo: 'Test AR',
            siteId: siteId,
          }),
        },
        {
          DB: env.DB,
          SESSIONS_KV: env.SESSIONS_KV,
          AUTH_JWT_SECRET: 'secret',
        } as any
      )

      const response = (await res.json()) as any
      expect(res.status).toBe(200)
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.id).toBeDefined()
      expect(response.data.docNo).toMatch(/^AR20230103-\d{3}$/)
    })
  })

  describe('POST /api/v2/borrowings', () => {
    it('should create a borrowing', async () => {
      const res = await app.request(
        '/api/v2/borrowings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: userId, // userId is already a UUID from setup
            accountId: accountId,
            amount: 500,
            currency: 'CNY',
            borrowDate: '2023-01-06',
            memo: 'Test Borrowing',
          }),
        },
        {
          DB: env.DB,
          SESSIONS_KV: env.SESSIONS_KV,
          AUTH_JWT_SECRET: 'secret',
        } as any
      )

      const response = (await res.json()) as any
      expect(res.status).toBe(200)
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.id).toBeDefined()
    })
  })

  describe('POST /api/v2/site-bills', () => {
    it('should create a site bill', async () => {
      const res = await app.request(
        '/api/v2/site-bills',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            siteId: siteId,
            billDate: '2023-01-09',
            billType: 'expense',
            amountCents: 1500,
            currency: 'CNY',
            description: 'Test Site Bill',
            status: 'pending',
          }),
        },
        {
          DB: env.DB,
          SESSIONS_KV: env.SESSIONS_KV,
          AUTH_JWT_SECRET: 'secret',
        } as any
      )

      const response = (await res.json()) as any
      expect(res.status).toBe(200)
      // V2 响应格式
      expect(response.success).toBe(true)
      expect(response.data.id).toBeDefined()
    })
  })
})
