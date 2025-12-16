import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { siteBillsRoutes } from '../../src/routes/v2/site-bills.js'
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
  isTeamMember: vi.fn(() => false),
  getDataAccessFilter: vi.fn(() => undefined),
}))

const mockSiteBillService = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getById: vi.fn(), // Needed for get details
}

// Mock DB
const mockDB = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    })),
  })),
}

describe('Site Bills Routes', () => {
  let app: Hono<{ Variables: any; Bindings: any }>
  const validId = uuid()
  const validSiteId = uuid()

  beforeEach(() => {
    app = new Hono()

    // Mock middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('services', {
        siteBill: mockSiteBillService,
      } as any)
      c.env = {
        DB: mockDB,
      }
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      console.error(err)
      return c.json({ error: err.message }, 500)
    })

    app.route('/', siteBillsRoutes)
  })

  it('should list site bills', async () => {
    const mockRow = {
      bill: {
        id: validId,
        siteId: validSiteId,
        billDate: '2023-01-01',
        billType: 'expense',
        amountCents: 1000,
        currency: 'CNY',
        status: 'pending',
        createdAt: 1234567890,
      },
      siteName: 'Test Site',
      siteCode: 'TS01',
      accountName: 'Bank',
      categoryName: 'Utilities',
      currencyName: 'RMB',
      creatorName: 'Admin',
    }
    mockSiteBillService.list.mockResolvedValue([mockRow])

    const res = await app.request('/site-bills?siteId=' + validSiteId, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // V2 响应格式
    expect(body.success).toBe(true)
    expect(body.data.results).toHaveLength(1)
    expect(body.data.results[0]).toEqual({
      id: validId,
      siteId: validSiteId,
      billDate: '2023-01-01',
      billType: 'expense',
      amountCents: 1000,
      currency: 'CNY',
      status: 'pending',
      createdAt: 1234567890,
      siteName: 'Test Site',
      siteCode: 'TS01',
      accountName: 'Bank',
      categoryName: 'Utilities',
      currencyName: 'RMB',
      creatorName: 'Admin',
      description: undefined,
      accountId: undefined,
      categoryId: undefined,
      paymentDate: undefined,
      memo: undefined,
      createdBy: undefined,
      updatedAt: undefined,
    })
  })

  it('should create site bill', async () => {
    const mockCreatedId = validId
    const mockResult = { id: mockCreatedId }
    mockSiteBillService.create.mockResolvedValue(mockResult)

    // Mock getById for the return
    mockSiteBillService.getById.mockResolvedValue({
      bill: {
        id: validId,
        siteId: validSiteId,
        billDate: '2023-01-01',
        billType: 'expense',
        amountCents: 1000,
        currency: 'CNY',
        status: 'pending',
      },
      siteName: 'Test Site',
      currencyName: 'RMB',
    })

    // Mock DB fetch after create
    const mockDBRecord = {
      id: validId,
      site_id: validSiteId,
      bill_date: '2023-01-01',
      bill_type: 'expense',
      amount_cents: 1000,
      currency: 'CNY',
      status: 'pending',
      site_name: 'Test Site',
      currency_name: 'RMB',
    }

    const expectedResponse = {
      id: validId,
      siteId: validSiteId,
      billDate: '2023-01-01',
      billType: 'expense',
      amountCents: 1000,
      currency: 'CNY',
      status: 'pending',
      siteName: 'Test Site',
      currencyName: 'RMB',
    }

    // Setup DB mock for the specific query
    const mockBind = {
      first: vi.fn().mockResolvedValue(mockDBRecord),
    }
    const mockPrepare = {
      bind: vi.fn(() => mockBind),
    }
    mockDB.prepare.mockReturnValue(mockPrepare)

    const res = await app.request('/site-bills', {
      method: 'POST',
      body: JSON.stringify({
        siteId: validSiteId,
        billDate: '2023-01-01',
        billType: 'expense',
        amountCents: 1000,
        currency: 'CNY',
        status: 'pending',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const createData = (await res.json()) as any
    // V2 响应格式
    expect(createData.success).toBe(true)
    expect(createData.data).toEqual(expectedResponse)
    expect(mockSiteBillService.create).toHaveBeenCalled()
  })

  it('should update site bill', async () => {
    const mockDBRecord = {
      id: validId,
      siteId: validSiteId,
      billDate: '2023-01-01',
      billType: 'expense',
      amountCents: 2000, // updated
      currency: 'CNY',
      status: 'paid',
      siteName: 'Test Site',
    }

    // Mock getById for the return
    mockSiteBillService.getById.mockResolvedValue({
      bill: mockDBRecord,
      siteName: 'Test Site',
    })

    const mockBind = {
      first: vi.fn().mockResolvedValue(mockDBRecord),
    }
    const mockPrepare = {
      bind: vi.fn(() => mockBind),
    }
    mockDB.prepare.mockReturnValue(mockPrepare)

    const res = await app.request(`/site-bills/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({
        billDate: '2023-01-01',
        billType: 'expense',
        amountCents: 2000,
        currency: 'CNY',
        status: 'paid',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const updateData = (await res.json()) as any
    // V2 响应格式
    expect(updateData.success).toBe(true)
    expect(updateData.data).toEqual(mockDBRecord)
    expect(mockSiteBillService.update).toHaveBeenCalled()
  })

  it('should delete site bill', async () => {
    // Mock DB check existing
    // getById is called first to check existence
    mockSiteBillService.getById.mockResolvedValue({
      bill: { id: validId, siteId: validSiteId, billDate: '2023-01-01' },
    })

    const mockRecord = { id: validId, siteId: validSiteId }
    const mockBind = {
      first: vi.fn().mockResolvedValue(mockRecord),
    }
    const mockPrepare = {
      bind: vi.fn(() => mockBind),
    }
    mockDB.prepare.mockReturnValue(mockPrepare)

    const res = await app.request(`/site-bills/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    // V2 响应格式
    expect(deleteData.success).toBe(true)
    expect(deleteData.data.ok).toBe(true)
    expect(mockSiteBillService.delete).toHaveBeenCalledWith(validId)
  })

  it('should get site bill details', async () => {
    const mockDBRecord = {
      id: validId,
      siteId: validSiteId,
      billDate: '2023-01-01',
      billType: 'electricity',
      amountCents: 1000,
      currency: 'CNY',
      status: 'pending',
      siteName: 'Test Site',
    }

    mockSiteBillService.getById.mockResolvedValue({
      bill: mockDBRecord,
      siteName: 'Test Site',
    })

    const mockBind = {
      first: vi.fn().mockResolvedValue(mockDBRecord),
    }
    const mockPrepare = {
      bind: vi.fn(() => mockBind),
    }
    mockDB.prepare.mockReturnValue(mockPrepare)

    const res = await app.request(`/site-bills/${validId}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const getData = (await res.json()) as any
    // V2 响应格式
    expect(getData.success).toBe(true)
    expect(getData.data).toEqual(mockDBRecord)
  })
})
