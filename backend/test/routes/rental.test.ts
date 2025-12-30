import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { rentalRoutes } from '../../src/routes/v2/rental.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permission-context - return a mock PermissionContext
vi.mock('../../src/utils/permission-context.js', () => ({
  createPermissionContext: vi.fn(() => ({
    employeeId: 'emp123',
    dataScope: 'all',
    canManageSubordinates: true,
    allowedModules: ['*'],
    permissions: {
      asset: {
        rental: ['view', 'create', 'update', 'delete'],
        fixed: ['view', 'create', 'update', 'delete', 'allocate'],
      },
    },
    position: {
      id: 'pos1',
      code: 'MGR',
      name: 'Manager',
      canManageSubordinates: 1,
      dataScope: 'all',
      permissions: {
        asset: {
          rental: ['view', 'create', 'update', 'delete'],
          fixed: ['view', 'create', 'update', 'delete', 'allocate'],
        },
      },
    },
    employee: {
      id: 'emp123',
      orgDepartmentId: 'dept1',
      projectId: 'proj1',
    },
    hasPermission: vi.fn(() => true),
    isModuleAllowed: vi.fn(() => true),
    checkPermissions: vi.fn(() => true),
    toJSON: vi.fn(() => ({})),
  })),
}))

const mockRentalService = {
  listProperties: vi.fn(),
  getProperty: vi.fn(),
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  listAllocations: vi.fn(),
  allocateDormitory: vi.fn(),
  returnDormitory: vi.fn(),
  listPayments: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  generatePayableBills: vi.fn(),
  listPayableBills: vi.fn(),
  markBillPaid: vi.fn(),
}

describe('Rental Routes', () => {
  let app: Hono<{ Variables: any }>
  const validId = uuid()
  const validPropId = uuid()
  const validEmpId = uuid()
  const validAccId = uuid()

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()

    // Mock middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('employeeId', 'emp123')
      c.set('userPosition', {
        id: 'pos1',
        code: 'MGR',
        name: 'Manager',
        canManageSubordinates: 1,
        dataScope: 'all',
        permissions: {
          asset: {
            rental: ['view', 'create', 'update', 'delete'],
            fixed: ['view', 'create', 'update', 'delete', 'allocate'],
          },
        },
      })
      c.set('userEmployee', {
        id: 'emp123',
        orgDepartmentId: 'dept1',
        projectId: 'proj1',
      })
      c.set('departmentModules', ['*'])
      c.set('services', {
        rental: mockRentalService,
      } as any)
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    app.route('/', rentalRoutes)
  })

  // --- Properties ---

  it('should list properties', async () => {
    const mockResult = [{ property: { id: validId, name: 'Office 1' } }]
    mockRentalService.listProperties.mockResolvedValue(mockResult)

    const res = await app.request('/rental-properties', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should get property details', async () => {
    const mockResult = { id: validId, name: 'Office 1' }
    mockRentalService.getProperty.mockResolvedValue(mockResult)

    const res = await app.request(`/rental-properties/${validId}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should create property', async () => {
    const mockResult = { id: validId }
    mockRentalService.createProperty.mockResolvedValue(mockResult)

    const res = await app.request('/rental-properties', {
      method: 'POST',
      body: JSON.stringify({
        propertyCode: 'P001',
        name: 'Office 1',
        propertyType: 'office',
        currency: 'CNY',
        rentType: 'monthly',
        monthlyRentCents: 10000,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const createData = (await res.json()) as any
    // V2 响应格式
    expect(createData.success).toBe(true)
    expect(createData.data).toEqual({ id: validId, propertyCode: 'P001' })
  })

  it('should update property', async () => {
    mockRentalService.updateProperty.mockResolvedValue(undefined)

    const res = await app.request(`/rental-properties/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Office 1 Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })

  it('should delete property', async () => {
    mockRentalService.deleteProperty.mockResolvedValue({ propertyCode: 'P001', name: 'Office 1' })

    const res = await app.request(`/rental-properties/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })

  // --- Allocations ---

  it('should list allocations', async () => {
    const mockResult = [{ allocation: { id: validId } }]
    mockRentalService.listAllocations.mockResolvedValue(mockResult)

    const res = await app.request('/rental-properties/allocations', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should allocate dormitory', async () => {
    const mockResult = { id: validId }
    mockRentalService.allocateDormitory.mockResolvedValue(mockResult)

    const res = await app.request(`/rental-properties/${validPropId}/allocate-dormitory`, {
      method: 'POST',
      body: JSON.stringify({
        employeeId: validEmpId,
        allocationDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should return dormitory', async () => {
    mockRentalService.returnDormitory.mockResolvedValue(undefined)

    const res = await app.request(`/rental-properties/allocations/${validId}/return`, {
      method: 'POST',
      body: JSON.stringify({
        returnDate: '2023-02-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })

  // --- Payments ---

  it('should list payments', async () => {
    const mockResult = [{ payment: { id: validId } }]
    mockRentalService.listPayments.mockResolvedValue(mockResult)

    const res = await app.request('/rental-payments', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should create payment', async () => {
    const mockResult = { id: validId, flowId: 'f1', voucherNo: 'v1' }
    mockRentalService.createPayment.mockResolvedValue(mockResult)

    const res = await app.request('/rental-payments', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: validPropId,
        paymentDate: '2023-01-01',
        year: 2023,
        month: 1,
        amountCents: 1000,
        currency: 'CNY',
        accountId: validAccId,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const createPaymentData = (await res.json()) as any
    // V2 响应格式
    expect(createPaymentData.success).toBe(true)
    expect(createPaymentData.data).toEqual({ id: validId, flowId: 'f1', voucherNo: 'v1' })
  })

  it('should update payment', async () => {
    mockRentalService.updatePayment.mockResolvedValue(undefined)

    const res = await app.request(`/rental-payments/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({ amountCents: 2000 }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })

  it('should delete payment', async () => {
    mockRentalService.deletePayment.mockResolvedValue({
      propertyId: validPropId,
      year: 2023,
      month: 1,
    })

    const res = await app.request(`/rental-payments/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })

  // --- Bills ---

  it('should generate payable bills', async () => {
    const mockResult = { generated: 1, bills: [{ id: validId }] }
    mockRentalService.generatePayableBills.mockResolvedValue(mockResult)

    const res = await app.request('/rental-properties/generate-payable-bills', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual(mockResult)
  })

  it('should list payable bills', async () => {
    const mockResult = [{ bill: { id: validId } }]
    mockRentalService.listPayableBills.mockResolvedValue(mockResult)

    const res = await app.request('/rental-payable-bills', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual(mockResult)
  })

  it('should mark bill as paid', async () => {
    mockRentalService.markBillPaid.mockResolvedValue({ ok: true })

    const res = await app.request(`/rental-payable-bills/${validId}/mark-paid`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.ok).toBe(true)
  })
})
