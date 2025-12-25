import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { fixedAssetsRoutes } from '../../src/routes/v2/fixed-assets.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
  getUserPosition: vi.fn(() => ({ id: 'pos1', name: 'Manager', function_role: 'admin' })),
  getUserEmployee: vi.fn(() => ({ id: 'emp1', name: 'Test User', departmentId: 'dept1' })),
  getUserId: vi.fn(() => 'user1'),
}))

const mockFixedAssetService = {
  list: vi.fn(),
  getCategories: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  purchase: vi.fn(),
  sell: vi.fn(),
}

const mockFixedAssetAllocationService = {
  listAllocations: vi.fn(),
  allocate: vi.fn(),
  return: vi.fn(),
}

const mockFixedAssetDepreciationService = {
  createDepreciation: vi.fn(),
}

const mockFixedAssetChangeService = {
  transfer: vi.fn(),
}

describe('Fixed Assets Routes', () => {
  let app: Hono<{ Variables: any }>
  const validId = uuid()

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()

    // Error handler first
    app.onError((err, c) => {
      console.error('Route error:', err.message)
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    // Mock middleware - must set services before routes
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('services', {
        fixedAsset: mockFixedAssetService,
        fixedAssetAllocation: mockFixedAssetAllocationService,
        fixedAssetDepreciation: mockFixedAssetDepreciationService,
        fixedAssetChange: mockFixedAssetChangeService,
      })
      await next()
    })

    app.route('/', fixedAssetsRoutes)
  })

  it('should list fixed assets', async () => {
    const mockResult = [
      {
        asset: { id: validId, assetCode: 'FA001', name: 'Laptop', purchasePriceCents: 100000 },
        departmentName: 'IT',
        siteName: 'HQ',
        vendorName: 'Dell',
        currencyName: 'CNY',
        createdByName: 'Admin',
      },
    ]
    mockFixedAssetService.list.mockResolvedValue(mockResult)

    const res = await app.request('/fixed-assets', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual([
      {
        id: validId,
        assetCode: 'FA001',
        name: 'Laptop',
        purchasePriceCents: 100000,
        departmentName: 'IT',
        siteName: 'HQ',
        vendorName: 'Dell',
        currencyName: 'CNY',
        createdByName: 'Admin',
      },
    ])
  })

  it('should list categories', async () => {
    const mockResult = [{ name: 'Electronics' }]
    mockFixedAssetService.getCategories.mockResolvedValue(mockResult)

    const res = await app.request('/fixed-assets/categories', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should list allocations', async () => {
    const employeeId = uuid()
    const mockResult = [
      {
        allocation: {
          id: validId,
          assetId: validId,
          employeeId,
          allocationDate: '2023-01-01',
        },
        assetCode: 'FA001',
        assetName: 'Laptop',
        employeeName: 'John',
        employeeDepartmentName: 'IT',
        createdByName: 'Admin',
      },
    ]
    mockFixedAssetAllocationService.listAllocations.mockResolvedValue(mockResult)

    const res = await app.request('/fixed-assets/allocations', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual([
      {
        id: validId,
        assetId: validId,
        employeeId,
        allocationDate: '2023-01-01',
        assetCode: 'FA001',
        assetName: 'Laptop',
        employeeName: 'John',
        employeeDepartmentName: 'IT',
        createdByName: 'Admin',
      },
    ])
  })

  it('should get fixed asset', async () => {
    const mockResult = {
      id: validId,
      assetCode: 'FA001',
      name: 'Laptop',
      depreciations: [],
      changes: [],
    }
    mockFixedAssetService.get.mockResolvedValue(mockResult)

    const res = await app.request(`/fixed-assets/${validId}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual({
      id: validId,
      assetCode: 'FA001',
      name: 'Laptop',
      depreciations: [],
      changes: [],
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
        currency: 'CNY',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const createData = (await res.json()) as any
    // V2 响应格式
    expect(createData.success).toBe(true)
    expect(createData.data).toEqual({
      id: validId,
      assetCode: 'FA001',
    })
  })

  it('should update fixed asset', async () => {
    mockFixedAssetService.update.mockResolvedValue({ ok: true })

    const res = await app.request(`/fixed-assets/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Laptop Updated',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const updateData = (await res.json()) as any
    // V2 响应格式
    expect(updateData.success).toBe(true)
    expect(updateData.data.ok).toBe(true)
  })

  it('should delete fixed asset', async () => {
    mockFixedAssetService.delete.mockResolvedValue(undefined)

    const res = await app.request(`/fixed-assets/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    // V2 响应格式
    expect(deleteData.success).toBe(true)
    expect(deleteData.data.ok).toBe(true)
  })

  it('should create depreciation', async () => {
    const mockResult = { id: uuid() }
    mockFixedAssetDepreciationService.createDepreciation.mockResolvedValue(mockResult)

    const res = await app.request(`/fixed-assets/${validId}/depreciation`, {
      method: 'POST',
      body: JSON.stringify({
        assetId: validId,
        depreciationDate: '2023-01-01',
        amountCents: 1000,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const depData = (await res.json()) as any
    // V2 响应格式
    expect(depData.success).toBe(true)
    expect(depData.data).toEqual(mockResult)
  })

  it('should transfer fixed asset', async () => {
    mockFixedAssetChangeService.transfer.mockResolvedValue({ ok: true })

    const res = await app.request(`/fixed-assets/${validId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({
        transferDate: '2023-01-01',
        toDepartmentId: uuid(),
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const transferData = (await res.json()) as any
    // V2 响应格式
    expect(transferData.success).toBe(true)
    expect(transferData.data.ok).toBe(true)
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
        purchaseDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const purchaseData = (await res.json()) as any
    // V2 响应格式
    expect(purchaseData.success).toBe(true)
    expect(purchaseData.data).toEqual({
      id: validId,
      assetCode: 'FA001',
      flowId: mockResult.flowId,
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
        categoryId: uuid(),
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const sellData = (await res.json()) as any
    // V2 响应格式
    expect(sellData.success).toBe(true)
    expect(sellData.data).toEqual({
      ok: true,
      flowId: mockResult.flowId,
    })
  })

  it('should allocate fixed asset', async () => {
    const mockResult = { id: uuid() }
    mockFixedAssetAllocationService.allocate.mockResolvedValue(mockResult)

    const res = await app.request('/fixed-assets/allocate', {
      method: 'POST',
      body: JSON.stringify({
        assetId: validId,
        employeeId: uuid(),
        allocationDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const allocateData = (await res.json()) as any
    // V2 响应格式
    expect(allocateData.success).toBe(true)
    expect(allocateData.data).toEqual(mockResult)
  })

  it('should return fixed asset', async () => {
    mockFixedAssetAllocationService.return.mockResolvedValue({ ok: true })

    const res = await app.request(`/fixed-assets/${validId}/return`, {
      method: 'POST',
      body: JSON.stringify({
        returnDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const returnData = (await res.json()) as any
    // V2 响应格式
    expect(returnData.success).toBe(true)
    expect(returnData.data.ok).toBe(true)
  })
})
