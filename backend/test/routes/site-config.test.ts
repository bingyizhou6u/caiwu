import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { siteConfigRoutes } from '../../src/routes/site-config.js'
import { Errors } from '../../src/utils/errors.js'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
    logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
    hasPermission: vi.fn(() => true),
}))

const mockSiteConfigService = {
    getConfigs: vi.fn(),
    updateConfig: vi.fn(),
    batchUpdateConfigs: vi.fn(),
}

describe('Site Config Routes', () => {
    let app: Hono

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', {
                siteConfig: mockSiteConfigService
            } as any)
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            return c.json({ error: err.message }, 500)
        })

        app.route('/', siteConfigRoutes)
    })

    it('should get all configs', async () => {
        const mockResult = [{ id: '1', config_key: 'site_name', config_value: 'My Site' }]
        mockSiteConfigService.getConfigs.mockResolvedValue(mockResult)

        const res = await app.request('/site-config', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should update config', async () => {
        mockSiteConfigService.updateConfig.mockResolvedValue({ ok: true })

        const res = await app.request('/site-config/site_name', {
            method: 'PUT',
            body: JSON.stringify({ config_value: 'New Name' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(mockSiteConfigService.updateConfig).toHaveBeenCalledWith('site_name', 'New Name')
    })

    it('should batch update configs', async () => {
        const mockResult = { ok: true, updated: 1, keys: ['site_name'] }
        mockSiteConfigService.batchUpdateConfigs.mockResolvedValue(mockResult)

        const res = await app.request('/site-config', {
            method: 'PUT',
            body: JSON.stringify({ site_name: 'New Name' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
        expect(mockSiteConfigService.batchUpdateConfigs).toHaveBeenCalledWith({ site_name: 'New Name' })
    })
})
