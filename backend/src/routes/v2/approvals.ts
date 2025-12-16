import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { Errors } from '../../utils/errors.js'
import { logAuditAction } from '../../utils/audit.js'
import { hasPermission } from '../../utils/permissions.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const approvalsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// --- Schema 定义 ---

const ApprovalActionSchema = z.object({
  memo: z.string().optional(),
})

const LeaveSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  leaveType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string().nullable(),
  reason: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  memo: z.string().nullable(),
  employeeName: z.string().nullable(),
  departmentName: z.string().nullable().optional(),
  orgDepartmentName: z.string().nullable().optional(),
})

const ReimbursementSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  expenseType: z.string(),
  amountCents: z.number(),
  currencyId: z.string().nullable(),
  expenseDate: z.string(),
  description: z.string(),
  voucherUrl: z.string().nullable(),
  status: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  memo: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  employeeName: z.string().nullable(),
  departmentName: z.string().nullable().optional(),
  orgDepartmentName: z.string().nullable().optional(),
  currencySymbol: z.string().nullable().optional(),
})

const BorrowingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  borrowerId: z.string().nullable(),
  accountId: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  borrowDate: z.string(),
  memo: z.string().nullable(),
  status: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  employeeName: z.string().nullable(),
  currencySymbol: z.string().nullable().optional(),
})

// GET /approvals/pending - 获取待审批列表
const getPendingApprovalsRoute = createRoute({
  method: 'get',
  path: '/approvals/pending',
  summary: 'Get pending approvals',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              leaves: z.array(LeaveSchema),
              reimbursements: z.array(ReimbursementSchema),
              borrowings: z.array(BorrowingSchema),
              counts: z.object({
                leaves: z.number(),
                reimbursements: z.number(),
                borrowings: z.number(),
              }),
            }),
          }),
        },
      },
      description: 'Pending approvals list',
    },
  },
})

approvalsRoutes.openapi(
  getPendingApprovalsRoute,
  createRouteHandler(async c => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    const service = c.var.services.approval
    const result = await service.getPendingApprovals(userId)
    return result
  })
)

// GET /approvals/history - 获取审批历史
const getApprovalHistoryRoute = createRoute({
  method: 'get',
  path: '/approvals/history',
  summary: 'Get approval history',
  request: {
    query: z.object({
      limit: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val) : 50)),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              leaves: z.array(LeaveSchema),
              reimbursements: z.array(ReimbursementSchema),
              borrowings: z.array(BorrowingSchema),
            }),
          }),
        },
      },
      description: 'Approval history list',
    },
  },
})

approvalsRoutes.openapi(
  getApprovalHistoryRoute,
  createRouteHandler(async c => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50
    const service = c.var.services.approval
    const result = await service.getApprovalHistory(userId, limit)
    return result
  })
)

// POST /approvals/leave/:id/approve - 批准请假申请
const approveLeaveRoute = createRoute({
  method: 'post',
  path: '/approvals/leave/{id}/approve',
  summary: 'Approve leave request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Approved successfully',
    },
  },
})

approvalsRoutes.openapi(
  approveLeaveRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.approveLeave(id, userId, body.memo)
    logAuditAction(c, 'approve', 'employee_leave', id, JSON.stringify({ action: 'approve' }))
    return { ok: true }
  }) as any
)

// POST /approvals/leave/:id/reject - 拒绝请假申请
const rejectLeaveRoute = createRoute({
  method: 'post',
  path: '/approvals/leave/{id}/reject',
  summary: 'Reject leave request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Rejected successfully',
    },
  },
})

approvalsRoutes.openapi(
  rejectLeaveRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.rejectLeave(id, userId, body.memo)
    logAuditAction(
      c,
      'reject',
      'employee_leave',
      id,
      JSON.stringify({ action: 'reject', memo: body.memo })
    )
    return { ok: true }
  }) as any
)

// POST /approvals/reimbursement/:id/approve - 批准报销申请
const approveReimbursementRoute = createRoute({
  method: 'post',
  path: '/approvals/reimbursement/{id}/approve',
  summary: 'Approve reimbursement request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Approved successfully',
    },
  },
})

approvalsRoutes.openapi(
  approveReimbursementRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    if (!hasPermission(c, 'hr', 'reimbursement', 'approve')) {
      throw Errors.FORBIDDEN('没有审批报销的权限')
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.approveReimbursement(id, userId, body.memo)
    logAuditAction(c, 'approve', 'expense_reimbursement', id, JSON.stringify({ action: 'approve' }))
    return { ok: true }
  }) as any
)

// POST /approvals/reimbursement/:id/reject - 拒绝报销申请
const rejectReimbursementRoute = createRoute({
  method: 'post',
  path: '/approvals/reimbursement/{id}/reject',
  summary: 'Reject reimbursement request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Rejected successfully',
    },
  },
})

approvalsRoutes.openapi(
  rejectReimbursementRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    if (!hasPermission(c, 'hr', 'reimbursement', 'approve')) {
      throw Errors.FORBIDDEN('没有审批报销的权限')
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.rejectReimbursement(id, userId, body.memo)
    logAuditAction(
      c,
      'reject',
      'expense_reimbursement',
      id,
      JSON.stringify({ action: 'reject', memo: body.memo })
    )
    return { ok: true }
  }) as any
)

// POST /approvals/borrowing/:id/approve - 批准借款申请
const approveBorrowingRoute = createRoute({
  method: 'post',
  path: '/approvals/borrowing/{id}/approve',
  summary: 'Approve borrowing request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Approved successfully',
    },
  },
})

approvalsRoutes.openapi(
  approveBorrowingRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    if (!hasPermission(c, 'finance', 'borrowing', 'approve')) {
      throw Errors.FORBIDDEN('没有审批借支的权限')
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.approveBorrowing(id, userId, body.memo)
    logAuditAction(c, 'approve', 'borrowing', id, JSON.stringify({ action: 'approve' }))
    return { ok: true }
  }) as any
)

// POST /approvals/borrowing/:id/reject - 拒绝借款申请
const rejectBorrowingRoute = createRoute({
  method: 'post',
  path: '/approvals/borrowing/{id}/reject',
  summary: 'Reject borrowing request',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: ApprovalActionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Rejected successfully',
    },
  },
})

approvalsRoutes.openapi(
  rejectBorrowingRoute,
  createRouteHandler(async (c: any) => {
    const userId = c.get('userId')
    if (!userId) {
      throw Errors.UNAUTHORIZED()
    }

    if (!hasPermission(c, 'finance', 'borrowing', 'approve')) {
      throw Errors.FORBIDDEN('没有审批借支的权限')
    }

    const id = c.req.param('id')
    const body = c.req.valid('json') as { memo?: string }
    const service = c.var.services.approval

    await service.rejectBorrowing(id, userId, body.memo)
    logAuditAction(
      c,
      'reject',
      'borrowing',
      id,
      JSON.stringify({ action: 'reject', memo: body.memo })
    )
    return { ok: true }
  }) as any
)
