import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { siteBillsRoutes } from '../../src/routes/site-bills.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
    hasPermission: vi.fn(() => true),
    getUserPosition: vi.fn(() => ({ id: 'pos1', name: 'Manager', level: 1 })),
    getUserId: vi.fn(() => 'user1'),
    isTeamMember: vi.fn(() => false),
    getDataAccessFilter: vi.fn(() => undefined),
}))

const mockFinanceService = {
    listSiteBills: vi.fn(),
    createSiteBill: vi.fn(),
    updateSiteBill: vi.fn(),
    deleteSiteBill: vi.fn(),
}

// Mock DB
const mockDB = {
    prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
            first: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        }))
    }))
}

describe('Site Bills Routes', () => {
    let app: Hono<{ Variables: any, Bindings: any }>
    const validId = uuid()
    const validSiteId = uuid()

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', {
                finance: mockFinanceService
            } as any)
            c.env = {
                DB: mockDB
            }
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            console.error(err)
            return c.json({ error: err.message }, 500)
        })

        app.route('/', siteBillsRoutes)
    })

    it('should list site bills', async () => {
        const mockRow = {
            bill: {
                id: validId,
                siteId: validSiteId,
                billDate: '2023-01-01',
                billType: 'expense',
                amountCents: 1000,
                currency: 'CNY',
                status: 'pending',
                createdAt: 1234567890
            },
            siteName: 'Test Site',
            siteCode: 'TS01',
            accountName: 'Bank',
            categoryName: 'Utilities',
            currencyName: 'RMB',
            creatorName: 'Admin'
        }
        mockFinanceService.listSiteBills.mockResolvedValue([mockRow])

        const res = await app.request('/site-bills?site_id=' + validSiteId, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.results).toHaveLength(1)
        expect(body.results[0]).toEqual({
            id: validId,
            site_id: validSiteId,
            bill_date: '2023-01-01',
            bill_type: 'expense',
            amount_cents: 1000,
            currency: 'CNY',
            status: 'pending',
            created_at: 1234567890,
            site_name: 'Test Site',
            site_code: 'TS01',
            account_name: 'Bank',
            category_name: 'Utilities',
            currency_name: 'RMB',
            creator_name: 'Admin',
            description: undefined,
            account_id: undefined,
            category_id: undefined,
            payment_date: undefined,
            memo: undefined,
            created_by: undefined,
            updated_at: undefined
        })
    })

    it('should create site bill', async () => {
        const mockCreatedId = validId
        const mockResult = { id: mockCreatedId }
        mockFinanceService.createSiteBill.mockResolvedValue(mockResult)

        // Mock DB fetch after create
        const mockDBRecord = {
            id: validId,
            site_id: validSiteId,
            bill_date: '2023-01-01',
            bill_type: 'expense',
            amount_cents: 1000,
            currency: 'CNY',
            status: 'pending',
            site_name: 'Test Site',
            currency_name: 'RMB'
        }
        
        // Setup DB mock for the specific query
        const mockBind = {
            first: vi.fn().mockResolvedValue(mockDBRecord)
        }
        const mockPrepare = {
            bind: vi.fn(() => mockBind)
        }
        mockDB.prepare.mockReturnValue(mockPrepare)

        const res = await app.request('/site-bills', {
            method: 'POST',
            body: JSON.stringify({
                site_id: validSiteId,
                bill_date: '2023-01-01',
                bill_type: 'expense',
                amount_cents: 1000,
                currency: 'CNY',
                status: 'pending'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockDBRecord)
        expect(mockFinanceService.createSiteBill).toHaveBeenCalled()
    })

    it('should update site bill', async () => {
        const mockDBRecord = {
            id: validId,
            site_id: validSiteId,
            bill_date: '2023-01-01',
            bill_type: 'expense',
            amount_cents: 2000, // updated
            currency: 'CNY',
            status: 'paid',
            site_name: 'Test Site'
        }

        const mockBind = {
            first: vi.fn().mockResolvedValue(mockDBRecord)
        }
        const mockPrepare = {
            bind: vi.fn(() => mockBind)
        }
        mockDB.prepare.mockReturnValue(mockPrepare)

        const res = await app.request(`/site-bills/${validId}`, {
            method: 'PUT',
            body: JSON.stringify({
                bill_date: '2023-01-01',
                bill_type: 'expense',
                amount_cents: 2000,
                currency: 'CNY',
                status: 'paid'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockDBRecord)
        expect(mockFinanceService.updateSiteBill).toHaveBeenCalled()
    })

    it('should delete site bill', async () => {
        // Mock DB check existing
        const mockRecord = { id: validId, site_id: validSiteId }
        const mockBind = {
            first: vi.fn().mockResolvedValue(mockRecord)
        }
        const mockPrepare = {
            bind: vi.fn(() => mockBind)
        }
        mockDB.prepare.mockReturnValue(mockPrepare)

        const res = await app.request(`/site-bills/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(mockFinanceService.deleteSiteBill).toHaveBeenCalledWith(validId)
    })

    it('should get site bill details', async () => {
         const mockDBRecord = {
            id: validId,
            site_id: validSiteId,
            bill_date: '2023-01-01',
            bill_type: 'electricity',
            amount_cents: 1000,
            currency: 'CNY',
            status: 'pending',
            site_name: 'Test Site'
        }

        const mockBind = {
            first: vi.fn().mockResolvedValue(mockDBRecord)
        }
        const mockPrepare = {
            bind: vi.fn(() => mockBind)
        }
        mockDB.prepare.mockReturnValue(mockPrepare)

        const res = await app.request(`/site-bills/${validId}`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockDBRecord)
    })
})

