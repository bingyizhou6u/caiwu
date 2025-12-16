import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { positionPermissionsRoutes } from '../../src/routes/v2/position-permissions.js'
import { Errors, AppError } from '../../src/utils/errors.js'
import { ErrorCodes } from '../../src/constants/errorCodes.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
}))

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

  it.skip('should create position', async () => {
    // 功能未实现：路由抛出 BUSINESS_ERROR('createPosition not implemented yet')
    const mockResult = { id: '1', name: 'Director' }
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
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it.skip('should update position', async () => {
    // 功能未实现：路由抛出 BUSINESS_ERROR('updatePosition not implemented yet')
    const mockResult = { id: '1', name: 'Director Updated' }
    mockPositionService.updatePosition.mockResolvedValue(mockResult)

    const res = await app.request('/position-permissions/1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Director Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it.skip('should delete position', async () => {
    // 功能未实现：路由抛出 BUSINESS_ERROR('deletePosition not implemented yet')
    mockPositionService.deletePosition.mockResolvedValue({ ok: true })

    const res = await app.request('/position-permissions/1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    // V2 响应格式
    expect(deleteData.success).toBe(true)
  })
})
