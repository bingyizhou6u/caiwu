import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { employeeSalariesRoutes } from '../../src/routes/v2/employee-salaries.js'
import { Errors } from '../../src/utils/errors.js'
import { v4 as uuid } from 'uuid'

// Mock audit utils
vi.mock('../../src/utils/audit.js', () => ({
  logAuditAction: vi.fn(),
}))

// Mock permissions
vi.mock('../../src/utils/permissions.js', () => ({
  hasPermission: vi.fn(() => true),
}))

const mockSalaryService = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  batchUpdate: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(), // Add get if needed
}

describe('Employee Salaries Routes', () => {
  let app: Hono<{ Variables: any }>
  const validId = uuid()
  const validEmpId = uuid()

  beforeEach(() => {
    app = new Hono()

    // Mock middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'user123')
      c.set('services', {
        salary: mockSalaryService,
      } as any)
      await next()
    })

    app.onError((err, c) => {
      if (err instanceof Error && 'statusCode' in err) {
        return c.json({ error: err.message }, (err as any).statusCode)
      }
      return c.json({ error: err.message }, 500)
    })

    app.route('/', employeeSalariesRoutes)

    // 默认 mock 返回，避免未设置时抛错
    mockSalaryService.list.mockResolvedValue([])
    mockSalaryService.create.mockResolvedValue({
      salary: {
        id: validId,
        employeeId: validEmpId,
        salaryType: 'regular',
        currencyId: 'CNY',
        amountCents: 0,
      },
      currencyName: 'RMB',
      employeeName: 'John',
    })
    mockSalaryService.update.mockResolvedValue({
      salary: {
        id: validId,
        employeeId: validEmpId,
        salaryType: 'regular',
        currencyId: 'CNY',
        amountCents: 0,
      },
      currencyName: 'RMB',
      employeeName: 'John',
    })
    mockSalaryService.batchUpdate.mockResolvedValue([])
    mockSalaryService.delete.mockResolvedValue({ id: validId })
  })

  it('should list salaries', async () => {
    const mockResult = [
      {
        salary: {
          id: validId,
          employeeId: validEmpId,
          salaryType: 'regular',
          currencyId: 'CNY',
          amountCents: 1000,
        },
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ]
    mockSalaryService.list.mockResolvedValue(mockResult)

    const res = await app.request(`/employee-salaries?employeeId=${validEmpId}`, {
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
        salaryType: 'regular',
        currencyId: 'CNY',
        amountCents: 1000,
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ])
  })

  it('should create salary', async () => {
    const mockSalary = {
      id: validId,
      employeeId: validEmpId,
      salaryType: 'regular',
      currencyId: 'CNY',
      amountCents: 1000,
    }
    const mockResult = {
      salary: mockSalary,
      currencyName: 'RMB',
      employeeName: 'John',
    }

    // Mock listSalaries to return empty (no duplicate)
    mockSalaryService.list.mockResolvedValue([])
    mockSalaryService.create.mockResolvedValue(mockResult)

    const res = await app.request('/employee-salaries', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: validEmpId,
        salaryType: 'regular',
        currencyId: 'CNY',
        amountCents: 1000,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const createData = (await res.json()) as any
    // V2 响应格式
    expect(createData.success).toBe(true)
    expect(createData.data).toEqual({
      id: validId,
      employeeId: validEmpId,
      salaryType: 'regular',
      currencyId: 'CNY',
      amountCents: 1000,
      currencyName: 'RMB',
      employeeName: 'John',
    })
  })

  it('should batch update salaries', async () => {
    const mockResult = [
      {
        salary: {
          id: validId,
          employeeId: validEmpId,
          salaryType: 'regular',
          currencyId: 'CNY',
          amountCents: 2000,
        },
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ]
    mockSalaryService.batchUpdate.mockResolvedValue(mockResult)

    const res = await app.request('/employee-salaries/batch', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: validEmpId,
        salaryType: 'regular',
        salaries: [{ currencyId: 'CNY', amountCents: 2000 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const batchData = (await res.json()) as any
    // V2 响应格式
    expect(batchData.success).toBe(true)
    expect(batchData.data.results).toEqual([
      {
        id: validId,
        employeeId: validEmpId,
        salaryType: 'regular',
        currencyId: 'CNY',
        amountCents: 2000,
        currencyName: 'RMB',
        employeeName: 'John',
      },
    ])
  })

  it('should delete salary', async () => {
    mockSalaryService.delete.mockResolvedValue({ id: validId })

    const res = await app.request(`/employee-salaries/${validId}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const deleteData = (await res.json()) as any
    // V2 响应格式
    expect(deleteData.success).toBe(true)
    expect(deleteData.data.ok).toBe(true)
  })
})
