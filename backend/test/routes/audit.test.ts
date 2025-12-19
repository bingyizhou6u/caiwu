import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { auditRoutes } from '../../src/routes/v2/audit.js'
import * as auditUtils from '../../src/utils/audit.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
}))

const mockAuditService = {
  getAuditLogs: vi.fn(),
  getAuditLogOptions: vi.fn(),
}

describe('Audit Routes', () => {
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
        audit: mockAuditService,
      } as any)
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    app.route('/', auditRoutes)
  })

  it('should get audit logs', async () => {
    const mockResult = {
      results: [{ id: '1', action: 'create', at: 1234567890 }],
      total: 1,
    }
    mockAuditService.getAuditLogs.mockResolvedValue(mockResult)

    const res = await app.request('/audit-logs?limit=10', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
    expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    )
  })

  it('should get audit log options', async () => {
    const mockResult = {
      actions: ['create'],
      entities: ['user'],
      actors: [],
    }
    mockAuditService.getAuditLogOptions.mockResolvedValue(mockResult)

    const res = await app.request('/audit-logs/options', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should export audit logs', async () => {
    const mockResult = {
      results: [
        {
          id: '1',
          action: 'create',
          at: 1234567890,
          actorName: 'Test User',
          actorEmail: 'test@example.com',
          entity: 'user',
          entityId: 'u1',
          ip: '127.0.0.1',
          ipLocation: 'Local',
          detail: 'Created user',
        },
      ],
      total: 1,
    }
    mockAuditService.getAuditLogs.mockResolvedValue(mockResult)

    const res = await app.request('/audit-logs/export', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const text = await res.text()
    expect(text).toContain('Test User')
    expect(text).toContain('Test User')
    expect(text).toContain('create')
  })

  it('should create audit log', async () => {
    const payload = {
      action: 'view_sensitive',
      entity: 'employee',
      entityId: 'e1',
      detail: 'Viewed salary',
    }

    const res = await app.request('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(auditUtils.logAuditAction).toHaveBeenCalledWith(
      expect.anything(),
      'view_sensitive',
      'employee',
      'e1',
      'Viewed salary'
    )
  })
})
