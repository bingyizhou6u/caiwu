import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { positionPermissionsRoutes } from '../../src/routes/v2/position-permissions.js'
import { AppError } from '../../src/utils/errors.js'
import { ErrorCodes } from '../../src/constants/errorCodes.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', async () => {
  const actual = await vi.importActual('../../src/utils/permissions.js')
  return {
    ...actual,
    hasPermission: vi.fn(() => true),
  }
})

const mockPositionService = {
  getPositions: vi.fn(),
  getPosition: vi.fn(),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  deletePosition: vi.fn(),
}

describe('Position Permissions Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()

    // Mock middleware
    app.use('*', async (c, next) => {
      // @ts-ignore
      c.set('userId', 'user123')
      // @ts-ignore
      c.set('services', {
        position: mockPositionService,
      } as any)
      await next()
    })

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

      if (err instanceof Error && 'statusCode' in err) {
        return c.json(
          {
            success: false,
            error: {
              code: ErrorCodes.SYS_INTERNAL_ERROR,
              message: err.message,
            },
          },
          (err as any).statusCode as any
        )
      }

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

    app.route('/', positionPermissionsRoutes)
  })

  it('should get all positions', async () => {
    const mockResult = [{ id: '1', name: 'Director' }]
    mockPositionService.getPositions.mockResolvedValue(mockResult)

    const res = await app.request('/position-permissions', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should get position details', async () => {
    const mockResult = { id: '1', name: 'Director' }
    mockPositionService.getPosition.mockResolvedValue(mockResult)

    const res = await app.request('/position-permissions/1', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should create position', async () => {
    const mockResult = { id: '1', code: 'DIR', name: 'Director', level: 1, functionRole: 'director' }
    mockPositionService.createPosition.mockResolvedValue(mockResult)

    const res = await app.request('/position-permissions', {
      method: 'POST',
      body: JSON.stringify({
        code: 'DIR',
        name: 'Director',
        level: 1,
        functionRole: 'director',
        permissions: {},
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('1')
    expect(data.data.code).toBe('DIR')
    expect(mockPositionService.createPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'DIR',
        name: 'Director',
        level: 1,
        functionRole: 'director',
      })
    )
  })

  it('should update position', async () => {
    const mockPosition = { id: '1', code: 'DIR', name: 'Director Updated', level: 1 }
    mockPositionService.updatePosition.mockResolvedValue({ ok: true })
    mockPositionService.getPositions.mockResolvedValue([mockPosition])

    const res = await app.request('/position-permissions/1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Director Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('Director Updated')
    expect(mockPositionService.updatePosition).toHaveBeenCalledWith('1', { name: 'Director Updated' })
  })

  it('should delete position', async () => {
    mockPositionService.deletePosition.mockResolvedValue({ ok: true, name: 'Director' })

    const res = await app.request('/position-permissions/1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    expect(deleteData.success).toBe(true)
    expect(mockPositionService.deletePosition).toHaveBeenCalledWith('1')
  })

  it('should return 403 when permission denied', async () => {
    const { hasPermission } = await import('../../src/utils/permissions.js')
    vi.mocked(hasPermission).mockReturnValue(false)

    const res = await app.request('/position-permissions', {
      method: 'POST',
      body: JSON.stringify({
        code: 'DIR',
        name: 'Director',
        level: 1,
        functionRole: 'director',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(403)
  })
})
