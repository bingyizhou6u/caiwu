import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { myRoutes } from '../../src/routes/my.js'
import { Errors } from '../../src/utils/errors.js'
import type { Env, AppVariables } from '../../src/types.js'

// Mock audit
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock MyService
const mockMyService = {
    getDashboardData: vi.fn(),
    getLeaves: vi.fn(),
    createLeave: vi.fn(),
    getReimbursements: vi.fn(),
    createReimbursement: vi.fn(),
    getBorrowings: vi.fn(),
    createBorrowing: vi.fn(),
    getAllowances: vi.fn(),
    getAssets: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getAttendanceToday: vi.fn(),
    getAttendanceList: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
}

describe('My Routes', () => {
    let app: Hono<{ Bindings: Env, Variables: AppVariables }>

    beforeEach(() => {
        vi.clearAllMocks()

        app = new Hono<{ Bindings: Env, Variables: AppVariables }>()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', { my: mockMyService } as any)
            await next()
        })

        // Error handler
        app.onError((err, c) => {
            if (err instanceof Error && err.message === 'Unauthorized') {
                return c.json({ error: 'Unauthorized' }, 401)
            }
            console.error(err)
            return c.json({ error: err.message }, 500)
        })

        app.route('/', myRoutes)
    })

    describe('Dashboard', () => {
        it('should return dashboard data', async () => {
            const mockData = { employee: { name: 'Test' }, stats: {}, recentApplications: [] }
            mockMyService.getDashboardData.mockResolvedValue(mockData)

            const res = await app.request('/my/dashboard', {
                method: 'GET',
            }, { DB: {} } as any)

            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toEqual(mockData)
            expect(mockMyService.getDashboardData).toHaveBeenCalledWith('user123')
        })
    })

    describe('Leaves', () => {
        it('should get leaves', async () => {
            const mockData = { leaves: [], stats: [] }
            mockMyService.getLeaves.mockResolvedValue(mockData)

            const res = await app.request('/my/leaves?year=2023', {
                method: 'GET',
            }, { DB: {} } as any)

            expect(res.status).toBe(200)
            expect(await res.json()).toEqual(mockData)
            expect(mockMyService.getLeaves).toHaveBeenCalledWith('user123', '2023', undefined)
        })

        it('should create leave', async () => {
            const mockResult = { ok: true, id: 'leave123' }
            mockMyService.createLeave.mockResolvedValue(mockResult)

            const body = {
                leave_type: 'annual',
                startDate: '2023-01-01',
                endDate: '2023-01-02',
                days: 2,
                reason: 'Rest'
            }

            const res = await app.request('/my/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }, { DB: {} } as any)

            expect(res.status).toBe(200)
            expect(await res.json()).toEqual(mockResult)
            expect(mockMyService.createLeave).toHaveBeenCalledWith('user123', body)
        })
    })

    // Add more tests for other endpoints as needed...

    describe('Attendance', () => {
        it('should clock in', async () => {
            const mockResult = { ok: true, clockInTime: 1234567890, status: 'normal' }
            mockMyService.clockIn.mockResolvedValue(mockResult)

            const res = await app.request('/my/attendance/clock-in', {
                method: 'POST',
            }, { DB: {} } as any)

            expect(res.status).toBe(200)
            expect(await res.json()).toEqual(mockResult)
        })

        it('should return 400 if clock in fails', async () => {
            const mockResult = { error: 'Already clocked in', clockInTime: 1234567890 }
            mockMyService.clockIn.mockResolvedValue(mockResult)

            const res = await app.request('/my/attendance/clock-in', {
                method: 'POST',
            }, { DB: {} } as any)

            expect(res.status).toBe(400)
            expect(await res.json()).toEqual(mockResult)
        })
    })
})
