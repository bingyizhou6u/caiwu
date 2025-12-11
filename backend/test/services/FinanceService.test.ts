import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { env } from 'cloudflare:test'
import { FinanceService } from '../../src/services/FinanceService'
import { createDb } from '../../src/utils/db'
import { uuid } from '../../src/utils/db'
import { accounts, categories, sites, departments,  employees, currencies, accountTransactions } from '../../src/db/schema'
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

        userId = uuid()
        await db.insert(employees).values({
            id: userId,
            email: 'test@example.com',
            name: 'User',
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
                createdBy: userId
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

    describe('Account Transfers', () => {
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

            const result = await service.createAccountTransfer({
                transferDate: '2023-01-02',
                fromAccountId: accountId,
                toAccountId: toAccountId,
                fromAmountCents: 5000,
                toAmountCents: 5000,
                memo: 'Test Transfer',
                createdBy: userId
            })

            expect(result.id).toBeDefined()

            const transfer = await service.getAccountTransfer(result.id)
            expect(transfer).toBeDefined()
            expect(transfer?.transfer.fromAmountCents).toBe(5000)
        })
    })

    describe('AR/AP Docs', () => {
        it('should create an AR doc', async () => {
            const result = await service.createArApDoc({
                kind: 'AR',
                amountCents: 2000,
                issueDate: '2023-01-03',
                memo: 'Test AR',
                siteId
            })

            expect(result.id).toBeDefined()
            expect(result.docNo).toMatch(/^AR20230103-\d{3}$/)
        })

        it('should confirm an AR doc', async () => {
            const { id: docId } = await service.createArApDoc({
                kind: 'AR',
                amountCents: 3000,
                issueDate: '2023-01-04',
                memo: 'Test AR Confirm'
            })

            const result = await service.confirmArApDoc({
                docId,
                accountId,
                bizDate: '2023-01-05',
                memo: 'Confirm AR',
                createdBy: userId
            })

            expect(result.ok).toBe(true)
            expect(result.flowId).toBeDefined()
        })
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
                createdBy: userId
            })

            expect(result.id).toBeDefined()
        })

        it('should create a repayment', async () => {
            const { id: borrowingId } = await service.createBorrowing({
                userId,
                accountId,
                amountCents: 10000,
                currency: 'CNY',
                borrowDate: '2023-01-07',
                memo: 'Test Borrowing for Repay'
            })

            const result = await service.createRepayment({
                borrowingId,
                accountId,
                amountCents: 5000,
                currency: 'CNY',
                repayDate: '2023-01-08',
                memo: 'Test Repayment',
                createdBy: userId
            })

            expect(result.id).toBeDefined()
        })
    })

    describe('Site Bills', () => {
        it('should create a site bill', async () => {
            const result = await service.createSiteBill({
                siteId,
                billDate: '2023-01-09',
                billType: 'expense',
                amountCents: 1500,
                currency: 'CNY',
                description: 'Test Site Bill',
                status: 'pending',
                createdBy: userId
            })

            expect(result.id).toBeDefined()
        })

        it('should update a site bill', async () => {
            const { id } = await service.createSiteBill({
                siteId,
                billDate: '2023-01-10',
                billType: 'income',
                amountCents: 2000,
                currency: 'CNY',
                description: 'Test Site Bill Update',
                status: 'pending'
            })

            const result = await service.updateSiteBill(id, {
                status: 'paid',
                paymentDate: '2023-01-11'
            })

            expect(result.ok).toBe(true)
        })

        it('should delete a site bill', async () => {
            const { id } = await service.createSiteBill({
                siteId,
                billDate: '2023-01-12',
                billType: 'expense',
                amountCents: 100,
                currency: 'CNY',
                description: 'Test Site Bill Delete',
                status: 'pending'
            })

            const result = await service.deleteSiteBill(id)
            expect(result.ok).toBe(true)
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
                createdBy: userId
            })

            // 2. Create Future Transaction (T2) on 2023-01-20
            const t2 = await service.createCashFlow({
                bizDate: '2023-01-20',
                type: 'income',
                accountId,
                amountCents: 2000,
                createdBy: userId
            })

            // 3. Backdate Transaction (T3) on 2023-01-15 (Between T1 and T2)
            const t3 = await service.createCashFlow({
                bizDate: '2023-01-15',
                type: 'income',
                accountId,
                amountCents: 500,
                createdBy: userId
            })

            // Verify Balances
            // T1 Balance: Opening(100000) + 1000 = 101000
            // T2 Balance: T1_Balance(101000) + 2000 = 103000 (Calculated at creation time)
            // T3 Balance: T1_Balance(101000) + 500 = 101500 (Calculated at creation time, finding T1 as last before)

            // Fetch transaction records to verify snapshots
            const txs = await db.select().from(accountTransactions).where(eq(accountTransactions.accountId, accountId)).orderBy(accountTransactions.transactionDate).execute()
            
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
