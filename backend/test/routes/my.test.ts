import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { myRoutes } from '../../src/routes/v2/my.js'
import { AppError } from '../../src/utils/errors.js'
import { ErrorCodes } from '../../src/constants/errorCodes.js'
import type { Env, AppVariables } from '../../src/types/index.js'

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
  let app: Hono<{ Bindings: Env; Variables: AppVariables }>

  beforeEach(() => {
    vi.clearAllMocks()

    app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

    // Mock middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('services', { my: mockMyService } as any)
      await next()
    })

    // Error handler - V2 format
    app.onError((err, c) => {
      if (err instanceof AppError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
          },
          err.statusCode as any
        )
      }

      // For other errors, check if it's a business error
      if (err instanceof Error && err.message === 'Unauthorized') {
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.AUTH_UNAUTHORIZED,
              message: 'Unauthorized',
            },
          },
          401 as any
        )
      }

      // Generic error
      return c.json(
        {
          success: false,
          error: {
            code: ErrorCodes.SYS_INTERNAL_ERROR,
            message: err.message || '系统内部错误',
          },
        },
        500 as any
      )
    })

    app.route('/', myRoutes)
  })

  describe('Dashboard', () => {
    it('should return dashboard data', async () => {
      const mockData = { employee: { name: 'Test' }, stats: {}, recentApplications: [] }
      mockMyService.getDashboardData.mockResolvedValue(mockData)

      const res = await app.request(
        '/my/dashboard',
        {
          method: 'GET',
        },
        { DB: {} } as any
      )

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      // V2 响应格式
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockData)
      expect(mockMyService.getDashboardData).toHaveBeenCalledWith('user123')
    })
  })

  describe('Leaves', () => {
    it('should get leaves', async () => {
      const mockData = { leaves: [], stats: [] }
      mockMyService.getLeaves.mockResolvedValue(mockData)

      const res = await app.request(
        '/my/leaves?year=2023',
        {
          method: 'GET',
        },
        { DB: {} } as any
      )

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      // V2 响应格式
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockData)
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
        reason: 'Rest',
      }

      const res = await app.request(
        '/my/leaves',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        { DB: {} } as any
      )

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      // V2 响应格式
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(mockMyService.createLeave).toHaveBeenCalledWith('user123', body)
    })
  })

  // Add more tests for other endpoints as needed...

  describe('Attendance', () => {
    it('should clock in', async () => {
      const mockResult = { ok: true, clockInTime: 1234567890, status: 'normal' }
      mockMyService.clockIn.mockResolvedValue(mockResult)

      const res = await app.request(
        '/my/attendance/clock-in',
        {
          method: 'POST',
        },
        { DB: {} } as any
      )

      expect(res.status).toBe(200)
      const data = (await res.json()) as any
      // V2 响应格式
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
    })

    it('should return 400 if clock in fails', async () => {
      // Mock service to return error result (not throw)
      mockMyService.clockIn.mockResolvedValue({
        error: 'Already clocked in',
        clockInTime: null,
        status: null,
      })

      const res = await app.request(
        '/my/attendance/clock-in',
        {
          method: 'POST',
        },
        { DB: {} } as any
      )

      // V2 错误响应格式 - 错误会被错误处理器捕获
      expect(res.status).toBeGreaterThanOrEqual(400)
      const data = (await res.json()) as any
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
      expect(data.error.message).toBe('Already clocked in')
    })
  })
})
