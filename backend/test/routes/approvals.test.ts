import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { approvalsRoutes } from '../../src/routes/v2/approvals.js'
import { createDb } from '../../src/db/index.js'
import { ApprovalService } from '../../src/services/common/ApprovalService.js'
import { EmployeeService } from '../../src/services/hr/EmployeeService.js'
import * as schema from '../../src/db/schema.js'
import { drizzle } from 'drizzle-orm/d1'
import { mockDeep } from 'vitest-mock-extended'

// Mock D1 Database
const mockD1 = mockDeep<D1Database>()
const mockStmt = {
  bind: vi.fn().mockReturnThis(),
  run: vi.fn().mockResolvedValue({ success: true }),
  first: vi.fn(),
  all: vi.fn(),
  raw: vi.fn(),
} as any
mockD1.prepare.mockReturnValue(mockStmt)

const db = drizzle(mockD1, { schema })

// Mock Services
const mockApprovalService = mockDeep<ApprovalService>()
const mockEmployeeService = mockDeep<EmployeeService>()

describe('Approval Routes', () => {
  let app: OpenAPIHono<any>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new OpenAPIHono()
    app.onError((err, c) => {
      console.error('Test Error:', err)
      return c.json({ error: err.message }, 500)
    })

    // Mock Middleware
    app.use('*', async (c, next) => {
      c.set('userId', 'approver-id')
      c.set('services', {
        approval: mockApprovalService,
        employee: mockEmployeeService,
      })
      c.set('userPosition', {
        id: 'pos-id',
        code: 'manager',
        permissions: {
          hr: { reimbursement: ['approve'] },
          finance: { borrowing: ['approve'] },
        },
      })
      await next()
    })

    app.route('/', approvalsRoutes)
  })

  const env = { DB: mockD1 }
  const executionCtx = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as any

  it('should get pending approvals', async () => {
    mockApprovalService.getPendingApprovals.mockResolvedValue({
      leaves: [],
      reimbursements: [],
      counts: { leaves: 0, reimbursements: 0 },
    })

    const res = await app.request('/approvals/pending', {}, env, executionCtx)
    expect(res.status).toBe(200)
    const response = (await res.json()) as any
    // V2 响应格式
    expect(response.success).toBe(true)
    expect(response.data.counts.leaves).toBe(0)
  })

  it('should approve leave', async () => {
    mockApprovalService.approveLeave.mockResolvedValue(undefined)

    const res = await app.request(
      '/approvals/leave/leave-id/approve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: 'Approved' }),
      },
      env,
      executionCtx
    )

    expect(res.status).toBe(200)
    expect(mockApprovalService.approveLeave).toHaveBeenCalledWith(
      'leave-id',
      'approver-id',
      'Approved'
    )
  })

  it('should reject leave', async () => {
    mockApprovalService.rejectLeave.mockResolvedValue(undefined)

    const res = await app.request(
      '/approvals/leave/leave-id/reject',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: 'Rejected' }),
      },
      env,
      executionCtx
    )

    expect(res.status).toBe(200)
    expect(mockApprovalService.rejectLeave).toHaveBeenCalledWith(
      'leave-id',
      'approver-id',
      'Rejected'
    )
  })

  it('should approve reimbursement with permission', async () => {
    mockApprovalService.approveReimbursement.mockResolvedValue(undefined)

    const res = await app.request(
      '/approvals/reimbursement/reimb-id/approve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: 'Ok' }),
      },
      env,
      executionCtx
    )

    expect(res.status).toBe(200)
    expect(mockApprovalService.approveReimbursement).toHaveBeenCalledWith(
      'reimb-id',
      'approver-id',
      'Ok'
    )
  })
})
