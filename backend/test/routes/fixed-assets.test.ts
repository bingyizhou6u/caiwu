import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { fixedAssetsRoutes } from '../../src/routes/fixed-assets.js'
import { Errors } from '../../src/utils/errors.js'
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
}))

const mockFixedAssetService = {
    list: vi.fn(),
    getCategories: vi.fn(),
    listAllocations: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createDepreciation: vi.fn(),
    transfer: vi.fn(),
    purchase: vi.fn(),
    sell: vi.fn(),
    allocate: vi.fn(),
    return: vi.fn(),
}

describe('Fixed Assets Routes', () => {
    let app: Hono<{ Variables: any }>
    const validId = uuid()

    beforeEach(() => {
        app = new Hono()

        // Mock middleware
        app.use('*', async (c, next) => {
            c.set('userId', 'user123')
            c.set('services', {
                fixedAsset: mockFixedAssetService
            } as any)
            await next()
        })

        app.onError((err, c) => {
            if (err instanceof Error && 'statusCode' in err) {
                return c.json({ error: err.message }, (err as any).statusCode)
            }
            return c.json({ error: err.message }, 500)
        })

        app.route('/', fixedAssetsRoutes)
    })

    it('should list fixed assets', async () => {
        const mockResult = [{
            asset: { id: validId, assetCode: 'FA001', name: 'Laptop', purchasePriceCents: 100000 },
            departmentName: 'IT',
            siteName: 'HQ',
            vendorName: 'Dell',
            currencyName: 'CNY',
            createdByName: 'Admin'
        }]
        mockFixedAssetService.list.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                asset_code: 'FA001',
                name: 'Laptop',
                purchase_price_cents: 100000,
                department_name: 'IT',
                site_name: 'HQ',
                vendor_name: 'Dell',
                currency_name: 'CNY',
                created_by_name: 'Admin'
            }]
        })
    })

    it('should list categories', async () => {
        const mockResult = [{ name: 'Electronics' }]
        mockFixedAssetService.getCategories.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets/categories', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ results: mockResult })
    })

    it('should list allocations', async () => {
        const mockResult = [{
            allocation: { id: validId, assetId: validId, employeeId: uuid(), allocationDate: '2023-01-01' },
            assetCode: 'FA001',
            assetName: 'Laptop',
            employeeName: 'John',
            employeeDepartmentName: 'IT',
            createdByName: 'Admin'
        }]
        mockFixedAssetService.listAllocations.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets/allocations', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            results: [{
                id: validId,
                asset_id: validId,
                employee_id: mockResult[0].allocation.employeeId,
                allocation_date: '2023-01-01',
                asset_code: 'FA001',
                asset_name: 'Laptop',
                employee_name: 'John',
                employee_department_name: 'IT',
                created_by_name: 'Admin'
            }]
        })
    })

    it('should get fixed asset', async () => {
        const mockResult = {
            id: validId,
            assetCode: 'FA001',
            name: 'Laptop',
            depreciations: [],
            changes: []
        }
        mockFixedAssetService.get.mockResolvedValue(mockResult)

        const res = await app.request(`/fixed-assets/${validId}`, {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            asset_code: 'FA001',
            name: 'Laptop',
            depreciations: [],
            changes: []
        })
    })

    it('should create fixed asset', async () => {
        const mockResult = { id: validId, assetCode: 'FA001' }
        mockFixedAssetService.create.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets', {
            method: 'POST',
            body: JSON.stringify({
                asset_code: 'FA001',
                name: 'Laptop',
                purchase_price_cents: 100000,
                currency: 'CNY'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            asset_code: 'FA001'
        })
    })

    it('should update fixed asset', async () => {
        mockFixedAssetService.update.mockResolvedValue({ ok: true })

        const res = await app.request(`/fixed-assets/${validId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: 'Laptop Updated'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('should delete fixed asset', async () => {
        mockFixedAssetService.delete.mockResolvedValue(undefined)

        const res = await app.request(`/fixed-assets/${validId}`, {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('should create depreciation', async () => {
        const mockResult = { id: uuid() }
        mockFixedAssetService.createDepreciation.mockResolvedValue(mockResult)

        const res = await app.request(`/fixed-assets/${validId}/depreciation`, {
            method: 'POST',
            body: JSON.stringify({
                asset_id: validId,
                depreciation_date: '2023-01-01',
                amount_cents: 1000
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should transfer fixed asset', async () => {
        mockFixedAssetService.transfer.mockResolvedValue({ ok: true })

        const res = await app.request(`/fixed-assets/${validId}/transfer`, {
            method: 'POST',
            body: JSON.stringify({
                transfer_date: '2023-01-01',
                to_department_id: uuid()
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })

    it('should purchase fixed asset', async () => {
        const mockResult = { id: validId, assetCode: 'FA001', flowId: uuid() }
        mockFixedAssetService.purchase.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets/purchase', {
            method: 'POST',
            body: JSON.stringify({
                asset_code: 'FA001',
                name: 'Laptop',
                purchase_price_cents: 100000,
                currency: 'CNY',
                account_id: uuid(),
                category_id: uuid(),
                purchase_date: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            asset_code: 'FA001',
            flow_id: mockResult.flowId
        })
    })

    it('should sell fixed asset', async () => {
        const mockResult = { ok: true, flowId: uuid() }
        mockFixedAssetService.sell.mockResolvedValue(mockResult)

        const res = await app.request(`/fixed-assets/${validId}/sell`, {
            method: 'POST',
            body: JSON.stringify({
                sale_date: '2023-01-01',
                sale_price_cents: 50000,
                currency: 'CNY',
                account_id: uuid(),
                category_id: uuid()
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            ok: true,
            flow_id: mockResult.flowId
        })
    })

    it('should allocate fixed asset', async () => {
        const mockResult = { id: uuid() }
        mockFixedAssetService.allocate.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets/allocate', {
            method: 'POST',
            body: JSON.stringify({
                asset_id: validId,
                employee_id: uuid(),
                allocation_date: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual(mockResult)
    })

    it('should return fixed asset', async () => {
        mockFixedAssetService.return.mockResolvedValue({ ok: true })

        const res = await app.request(`/fixed-assets/${validId}/return`, {
            method: 'POST',
            body: JSON.stringify({
                return_date: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
