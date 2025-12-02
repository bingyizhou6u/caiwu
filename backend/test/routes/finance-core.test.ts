import { describe, it, expect, beforeAll, vi } from 'vitest'
import app from '../../src/index'
import { env } from 'cloudflare:test'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import { accounts, categories, sites, departments, users, employees, currencies } from '../../src/db/schema'
import schemaSql from '../../src/db/schema.sql?raw'
import { FinanceService } from '../../src/services/FinanceService'
import { AuthService } from '../../src/services/AuthService'
import { MasterDataService } from '../../src/services/MasterDataService'
import { SalaryPaymentService } from '../../src/services/SalaryPaymentService'

// Mock permissions
vi.mock('../../src/utils/permissions', async () => {
    const actual = await vi.importActual<any>('../../src/utils/permissions')
    return {
        ...actual,
        hasPermission: () => true,
        getDataAccessFilter: () => ({ where: '1=1', binds: [] }),
        getUserEmployee: () => ({ id: 'emp-1', name: 'Test User' })
    }
})

// Mock middleware
vi.mock('../../src/middleware', async () => {
    return {
        createAuthMiddleware: () => async (c: any, next: any) => {
            c.set('userId', '550e8400-e29b-41d4-a716-446655440000')
            await next()
        }
    }
})

// Mock audit
vi.mock('../../src/utils/audit', () => ({
    logAudit: vi.fn(),
    logAuditAction: vi.fn()
}))

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
        const authService = new AuthService(db, env.SESSIONS_KV)
        const masterDataService = new MasterDataService(db)
        const financeService = new FinanceService(db)
        const salaryPaymentService = new SalaryPaymentService(db)

        // Inject services into app
        app.use('*', async (c, next) => {
            c.set('services', {
                auth: authService,
                masterData: masterDataService,
                finance: financeService,
                salaryPayment: salaryPaymentService
            } as any)
            c.set('userId', '550e8400-e29b-41d4-a716-446655440000')
            await next()
        })

        // Setup master data
        accountId = uuid()
        await db.insert(accounts).values({
            id: accountId,
            name: 'Test Account',
            currency: 'CNY',
            type: 'bank',
            openingCents: 100000,
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        categoryId = uuid()
        await db.insert(categories).values({
            id: categoryId,
            name: 'Test Category',
            kind: 'expense',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        departmentId = uuid()
        await db.insert(departments).values({
            id: departmentId,
            name: 'Test Department',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        siteId = uuid()
        await db.insert(sites).values({
            id: siteId,
            name: 'Test Site',
            siteCode: 'TS001',
            departmentId,
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        userId = '550e8400-e29b-41d4-a716-446655440000'
        await db.insert(users).values({
            id: userId,
            email: 'test@example.com',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        await db.insert(employees).values({
            email: 'test@example.com',
            name: 'Test User',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()

        await db.insert(currencies).values({
            code: 'CNY',
            name: 'Chinese Yuan',
            symbol: '¥',
            active: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).execute()
    })

    describe('POST /api/flows', () => {
        it('should create a cash flow', async () => {
            const res = await app.request('/api/flows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    biz_date: '2023-01-01',
                    type: 'expense',
                    account_id: accountId,
                    amount_cents: 1000,
                    category_id: categoryId,
                    site_id: siteId,
                    department_id: departmentId,
                    memo: 'Test Expense',
                    voucher_urls: ['http://example.com/voucher.jpg']
                })
            }, {
                DB: env.DB,
                SESSIONS_KV: env.SESSIONS_KV,
                AUTH_JWT_SECRET: 'secret'
            } as any)

            const body = await res.json() as any
            expect(res.status).toBe(200)
            expect(body.id).toBeDefined()
            expect(body.voucher_no).toMatch(/^JZ20230101-\d{3}$/)
        })
    })

    describe('POST /api/account-transfers', () => {
        it('should create an account transfer', async () => {
            const toAccountId = uuid()
            await db.insert(accounts).values({
                id: toAccountId,
                name: 'To Account',
                currency: 'CNY',
                type: 'bank',
                openingCents: 0,
                active: 1,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }).execute()

            const res = await app.request('/api/account-transfers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    transfer_date: '2023-01-02',
                    from_account_id: accountId,
                    to_account_id: toAccountId,
                    from_amount_cents: 5000,
                    to_amount_cents: 5000,
                    memo: 'Test Transfer'
                })
            }, {
                DB: env.DB,
                SESSIONS_KV: env.SESSIONS_KV,
                AUTH_JWT_SECRET: 'secret'
            } as any)

            const body = await res.json() as any
            expect(res.status).toBe(200)
            expect(body.id).toBeDefined()
        })
    })

    describe('POST /api/ar/docs', () => {
        it('should create an AR doc', async () => {
            const res = await app.request('/api/ar/docs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    kind: 'AR',
                    amount_cents: 2000,
                    issue_date: '2023-01-03',
                    memo: 'Test AR',
                    site_id: siteId
                })
            }, {
                DB: env.DB,
                SESSIONS_KV: env.SESSIONS_KV,
                AUTH_JWT_SECRET: 'secret'
            } as any)

            const body = await res.json() as any
            expect(res.status).toBe(200)
            expect(body.id).toBeDefined()
            expect(body.doc_no).toMatch(/^AR20230103-\d{3}$/)
        })
    })

    describe('POST /api/borrowings', () => {
        it('should create a borrowing', async () => {
            const res = await app.request('/api/borrowings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_id: userId, // userId is already a UUID from setup
                    account_id: accountId,
                    amount: 500,
                    currency: 'CNY',
                    borrow_date: '2023-01-06',
                    memo: 'Test Borrowing'
                })
            }, {
                DB: env.DB,
                SESSIONS_KV: env.SESSIONS_KV,
                AUTH_JWT_SECRET: 'secret'
            } as any)

            const body = await res.json() as any
            expect(res.status).toBe(200)
            expect(body.id).toBeDefined()
        })
    })

    describe('POST /api/site-bills', () => {
        it('should create a site bill', async () => {
            const res = await app.request('/api/site-bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    site_id: siteId,
                    bill_date: '2023-01-09',
                    bill_type: 'expense',
                    amount_cents: 1500,
                    currency: 'CNY',
                    description: 'Test Site Bill',
                    status: 'pending'
                })
            }, {
                DB: env.DB,
                SESSIONS_KV: env.SESSIONS_KV,
                AUTH_JWT_SECRET: 'secret'
            } as any)

            const body = await res.json() as any
            expect(res.status).toBe(200)
            expect(body.id).toBeDefined()
        })
    })
})
