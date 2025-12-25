import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { allowancePaymentsRoutes } from '../../src/routes/v2/allowance-payments.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
  getUserPosition: vi.fn(() => ({ id: 'pos1', name: 'Manager' })),
  getUserId: vi.fn(() => 'user1'),
  isTeamMember: vi.fn(() => false),
}))

const mockAllowancePaymentService = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  generate: vi.fn(),
  get: vi.fn(),
}

describe('Allowance Payments Routes', () => {
  let app: Hono<{ Variables: any }>
  const validId = uuid()
  const validEmpId = uuid()

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()

    // Mock middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('services', {
        allowancePayment: mockAllowancePaymentService,
      } as any)
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    app.route('/', allowancePaymentsRoutes)

    // 默认 mock 返回，避免未设置时抛错
    mockAllowancePaymentService.list.mockResolvedValue([])
    mockAllowancePaymentService.create.mockResolvedValue({
      payment: {
        id: validId,
        employeeId: validEmpId,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 0,
        year: 2023,
        month: 1,
      },
      currencyName: 'RMB',
      employeeName: 'John',
    })
    mockAllowancePaymentService.update.mockResolvedValue({
      payment: {
        id: validId,
        employeeId: validEmpId,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 0,
        year: 2023,
        month: 1,
      },
      currencyName: 'RMB',
      employeeName: 'John',
    })
    mockAllowancePaymentService.delete.mockResolvedValue({ id: validId })
    mockAllowancePaymentService.generate.mockResolvedValue({ created: 0, ids: [] })
  })

  it('should list allowance payments', async () => {
    const mockResult = [
      {
        payment: {
          id: validId,
          employeeId: validEmpId,
          allowanceType: 'meal',
          currencyId: 'CNY',
          amountCents: 500,
          year: 2023,
          month: 1,
        },
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ]
    mockAllowancePaymentService.list.mockResolvedValue(mockResult)

    const res = await app.request(`/allowance-payments?year=2023&month=1`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data.results).toEqual([
      {
        id: validId,
        employeeId: validEmpId,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 500,
        year: 2023,
        month: 1,
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ])
  })

  it('should create allowance payment', async () => {
    const mockPayment = {
      id: validId,
      employeeId: validEmpId,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 500,
      year: 2023,
      month: 1,
    }
    const mockResult = {
      payment: mockPayment,
      currencyName: 'RMB',
      employeeName: 'John',
    }
    mockAllowancePaymentService.create.mockResolvedValue(mockResult)

    const res = await app.request('/allowance-payments', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: validEmpId,
        year: 2023,
        month: 1,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 500,
        paymentDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as any
    // V2 响应格式
    expect(data.success).toBe(true)
    expect(data.data).toEqual({
      id: validId,
      employeeId: validEmpId,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 500,
      year: 2023,
      month: 1,
      currencyName: 'RMB',
      employeeName: 'John',
    })
  })

  it('should update allowance payment', async () => {
    const mockResult = {
      payment: {
        id: validId,
        employeeId: validEmpId,
        allowanceType: 'meal',
        currencyId: 'CNY',
        amountCents: 600,
        year: 2023,
        month: 1,
      },
      currencyName: 'RMB',
      employeeName: 'John',
    }
    mockAllowancePaymentService.update.mockResolvedValue(mockResult)

    const res = await app.request(`/allowance-payments/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({
        amountCents: 600,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const updateData = (await res.json()) as any
    // V2 响应格式
    expect(updateData.success).toBe(true)
    expect(updateData.data).toEqual({
      id: validId,
      employeeId: validEmpId,
      allowanceType: 'meal',
      currencyId: 'CNY',
      amountCents: 600,
      year: 2023,
      month: 1,
      currencyName: 'RMB',
      employeeName: 'John',
    })
  })

  it('should delete allowance payment', async () => {
    mockAllowancePaymentService.delete.mockResolvedValue({ id: validId })

    const res = await app.request(`/allowance-payments/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    // V2 响应格式
    expect(deleteData.success).toBe(true)
    expect(deleteData.data.ok).toBe(true)
  })

  it('should generate allowance payments', async () => {
    const mockResult = { created: 1, ids: [validId] }
    mockAllowancePaymentService.generate.mockResolvedValue(mockResult)

    const res = await app.request('/allowance-payments/generate', {
      method: 'POST',
      body: JSON.stringify({
        year: 2023,
        month: 1,
        paymentDate: '2023-01-01',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const generateData = (await res.json()) as any
    // V2 响应格式
    expect(generateData.success).toBe(true)
    expect(generateData.data).toEqual(mockResult)
  })
})
