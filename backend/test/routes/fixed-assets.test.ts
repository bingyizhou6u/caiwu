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
    getUserEmployee: vi.fn(() => null),
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
                assetCode: 'FA001',
                name: 'Laptop',
                purchasePriceCents: 100000,
                departmentName: 'IT',
                siteName: 'HQ',
                vendorName: 'Dell',
                currencyName: 'CNY',
                createdByName: 'Admin'
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
                assetId: validId,
                employeeId: mockResult[0].allocation.employeeId,
                allocationDate: '2023-01-01',
                assetCode: 'FA001',
                assetName: 'Laptop',
                employeeName: 'John',
                employeeDepartmentName: 'IT',
                createdByName: 'Admin'
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
            assetCode: 'FA001',
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
                assetCode: 'FA001',
                name: 'Laptop',
                purchasePriceCents: 100000,
                currency: 'CNY'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            assetCode: 'FA001'
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
                assetId: validId,
                depreciationDate: '2023-01-01',
                amountCents: 1000
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
                transferDate: '2023-01-01',
                toDepartmentId: uuid()
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
                assetCode: 'FA001',
                name: 'Laptop',
                purchasePriceCents: 100000,
                currency: 'CNY',
                accountId: uuid(),
                categoryId: uuid(),
                purchaseDate: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            id: validId,
            assetCode: 'FA001',
            flowId: mockResult.flowId
        })
    })

    it('should sell fixed asset', async () => {
        const mockResult = { ok: true, flowId: uuid() }
        mockFixedAssetService.sell.mockResolvedValue(mockResult)

        const res = await app.request(`/fixed-assets/${validId}/sell`, {
            method: 'POST',
            body: JSON.stringify({
                saleDate: '2023-01-01',
                salePriceCents: 50000,
                currency: 'CNY',
                accountId: uuid(),
                categoryId: uuid()
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            ok: true,
            flowId: mockResult.flowId
        })
    })

    it('should allocate fixed asset', async () => {
        const mockResult = { id: uuid() }
        mockFixedAssetService.allocate.mockResolvedValue(mockResult)

        const res = await app.request('/fixed-assets/allocate', {
            method: 'POST',
            body: JSON.stringify({
                assetId: validId,
                employeeId: uuid(),
                allocationDate: '2023-01-01'
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
                returnDate: '2023-01-01'
            }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
