import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { ipWhitelistRoutes } from '../../src/routes/v2/ip-whitelist.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
}))

const mockIPWhitelistService = {
  getIPList: vi.fn(),
  addIP: vi.fn(),
  batchAddIPs: vi.fn(),
  batchDeleteIPs: vi.fn(),
  deleteIP: vi.fn(),
  getRuleStatus: vi.fn(),
  toggleRule: vi.fn(),
}

describe('IP Whitelist Routes', () => {
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
        ipWhitelist: mockIPWhitelistService,
      } as any)
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    app.route('/', ipWhitelistRoutes)
  })

  it('should get IP list', async () => {
    const mockResult = [{ id: '1', ipAddress: '1.2.3.4' }]
    mockIPWhitelistService.getIPList.mockResolvedValue(mockResult)

    const res = await app.request('/ip-whitelist', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式：data.results 包含列表
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should add IP', async () => {
    const mockResult = { id: '1', ipAddress: '1.2.3.4' }
    mockIPWhitelistService.addIP.mockResolvedValue(mockResult)

    const res = await app.request('/ip-whitelist', {
      method: 'POST',
      body: JSON.stringify({ ipAddress: '1.2.3.4' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
    expect(mockIPWhitelistService.addIP).toHaveBeenCalledWith('1.2.3.4', undefined)
  })

  it('should batch add IPs', async () => {
    const mockResult = { success: true, successCount: 1, failedCount: 0 }
    mockIPWhitelistService.batchAddIPs.mockResolvedValue(mockResult)

    const res = await app.request('/ip-whitelist/batch', {
      method: 'POST',
      body: JSON.stringify({ ips: [{ ip: '1.2.3.4' }] }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should batch delete IPs', async () => {
    const mockResult = { success: true, successCount: 1, failedCount: 0 }
    mockIPWhitelistService.batchDeleteIPs.mockResolvedValue(mockResult)
    const id = '123e4567-e89b-12d3-a456-426614174000'

    const res = await app.request('/ip-whitelist/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids: [id] }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should delete IP', async () => {
    mockIPWhitelistService.deleteIP.mockResolvedValue({ ok: true })

    const res = await app.request('/ip-whitelist/1', {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(mockIPWhitelistService.deleteIP).toHaveBeenCalledWith('1')
  })

  it('should get rule status', async () => {
    const mockResult = { enabled: true }
    mockIPWhitelistService.getRuleStatus.mockResolvedValue(mockResult)

    const res = await app.request('/ip-whitelist/rule', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should toggle rule', async () => {
    const mockResult = { ok: true, enabled: true }
    mockIPWhitelistService.toggleRule.mockResolvedValue(mockResult)

    const res = await app.request('/ip-whitelist/rule/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
    expect(mockIPWhitelistService.toggleRule).toHaveBeenCalledWith(true)
  })
})
