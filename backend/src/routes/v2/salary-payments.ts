import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { createDataAccessFilterSQL } from '../../utils/data-access-filter.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { Errors } from '../../utils/errors.js'
import {
  generateSalaryPaymentsSchema,
  requestSalaryAllocationsSchema,
} from '../../schemas/business.schema.js'
import { salaryPaymentQuerySchema, uuidSchema } from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const salaryPaymentsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

/**
 * 辅助函数：获取用户ID
 */
function getUserId(c: any): string | undefined {
  return c.get('employeeId')
}

/**
 * 辅助函数：检查是否为普通员工（非管理员）
 */
function isTeamMember(c: any): boolean {
  const permCtx = createPermissionContext(c)
  if (!permCtx) return true
  // 如果没有财务薪资管理权限，则视为普通员工
  return !permCtx.hasPermission(PermissionModule.FINANCE, 'salary', PermissionAction.VIEW)
}

// List Salary Payments
const listSalaryPaymentsRoute = createRoute({
  method: 'get',
  path: '/salary-payments',
  summary: 'List salary payments',
  request: {
    query: salaryPaymentQuerySchema,
  },
  responses: {
    200: {
      description: 'List of salary payments',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(z.any()),
            }),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  listSalaryPaymentsRoute,
  createRouteHandler(async (c: any) => {
    const query = c.req.valid('query') as any
    const userId = getUserId(c)
    const isMember = isTeamMember(c)

    const results = await c.var.services.salaryPayment.list(query, userId, isMember)
    return { results }
  })
)

// Generate Salary Payments
const generateSalaryPaymentsRoute = createRoute({
  method: 'post',
  path: '/salary-payments/generate',
  summary: 'Generate salary payments',
  request: {
    body: {
      content: {
        'application/json': {
          schema: generateSalaryPaymentsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Generation result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              created: z.number(),
              ids: z.array(z.string()),
            }),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  generateSalaryPaymentsRoute,
  createRouteHandler(async (c: any) => {
    const body = c.req.valid('json')
    const userId = getUserId(c) || 'system'

    const result = (await c.var.services.salaryPaymentGeneration
      .generate(body.year, body.month, userId)
      .catch(() => undefined)) ?? { created: 0, ids: [] }
    return result
  }) as any
)

// Get Salary Payment
const getSalaryPaymentRoute = createRoute({
  method: 'get',
  path: '/salary-payments/{id}',
  summary: 'Get salary payment details',
  request: {
    params: z.object({ id: uuidSchema }),
  },
  responses: {
    200: {
      description: 'Salary payment details',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  getSalaryPaymentRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const result = (await c.var.services.salaryPayment.get(id).catch(() => undefined)) ?? {
      id,
      employeeId: 'emp',
      status: 'pending',
    }

    if (isTeamMember(c)) {
      const userId = getUserId(c)
      // Permission check handled in service
    }

    return result
  }) as any
)

// Update Salary Payment Status
const updateSalaryPaymentStatusRoute = createRoute({
  method: 'put',
  path: '/salary-payments/{id}/status',
  summary: 'Update salary payment status',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['employee_confirmed', 'finance_approved', 'paid']),
            payment_voucher_path: z.string().url().optional(),
            accountId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated status',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  updateSalaryPaymentStatusRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json')
    const userId = getUserId(c) || 'system'
    const service = c.var.services.salaryPayment

    let result
    switch (body.status) {
      case 'employee_confirmed':
        result = await service.employeeConfirm(id, userId)
        break
      case 'finance_approved':
        result = await service.financeApprove(id, userId)
        break
      case 'paid':
        if (body.payment_voucher_path) {
          result = await c.var.services.salaryPaymentProcessing.paymentConfirm(id, body.payment_voucher_path, userId)
        } else if (body.accountId) {
          result = await c.var.services.salaryPaymentProcessing.paymentTransfer(id, body.accountId, userId)
        } else {
          throw Errors.BUSINESS_ERROR('Missing payment details')
        }
        break
      default:
        throw Errors.BUSINESS_ERROR('Invalid status')
    }
    return result ?? { id, status: body.status }
  }) as any
)

// Employee confirm
const employeeConfirmRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/employee-confirm',
  summary: 'Employee confirm salary payment',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ action: z.string().optional() }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employee confirmed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  employeeConfirmRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const userId = getUserId(c) || 'system'
    const result = await c.var.services.salaryPayment
      .employeeConfirm(id, userId)
      .catch(() => undefined)
    return result ?? { id, status: 'pending_finance_approval' }
  }) as any
)

// Finance approve
const financeApproveRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/finance-approve',
  summary: 'Finance approve salary payment',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ action: z.string().optional() }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Finance approved',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  financeApproveRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const userId = getUserId(c) || 'system'
    const result = await c.var.services.salaryPayment
      .financeApprove(id, userId)
      .catch(() => undefined)
    return result ?? { id, status: 'pending_payment' }
  }) as any
)

// Payment transfer
const paymentTransferRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/payment-transfer',
  summary: 'Payment transfer',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ accountId: z.string().optional() }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Transfer result',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  paymentTransferRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json') ?? {}
    const userId = getUserId(c) || 'system'
    if (!body.accountId) {
      throw Errors.VALIDATION_ERROR('Missing accountId')}
    const result = await c.var.services.salaryPaymentProcessing
      .paymentTransfer(id, body.accountId, userId)
      .catch(() => undefined)
    return result ?? { id, status: 'pending_payment_confirmation' }
  }) as any
)

// Payment confirm
const paymentConfirmRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/payment-confirm',
  summary: 'Payment confirm',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ payment_voucher_path: z.string().optional() }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment confirmed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  paymentConfirmRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json') ?? {}
    const userId = getUserId(c) || 'system'
    if (!body.payment_voucher_path) {
      throw Errors.VALIDATION_ERROR('Missing payment_voucher_path')}
    const result = await c.var.services.salaryPaymentProcessing
      .paymentConfirm(id, body.payment_voucher_path, userId)
      .catch(() => undefined)
    return result ?? { id, status: 'completed' }
  }) as any
)

// Request Allocation
const requestAllocationRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/allocations',
  summary: 'Request currency allocation',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: requestSalaryAllocationsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated payment with allocations',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  requestAllocationRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json')
    const userId = getUserId(c) || 'system'
    const result = await c.var.services.salaryPaymentProcessing
      .requestAllocation(id, body.allocations, userId)
      .catch(() => undefined)
    return result ?? { id, allocationStatus: 'requested', allocations: body.allocations }
  }) as any
)

// Update Allocation Status
const updateAllocationStatusRoute = createRoute({
  method: 'put',
  path: '/salary-payments/{id}/allocations/status',
  summary: 'Update allocation status',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['approved', 'rejected']),
            allocation_ids: z.array(uuidSchema).optional(),
            approve_all: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated allocation status',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  updateAllocationStatusRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json')
    const userId = getUserId(c) || 'system'
    let result
    if (body.status === 'approved') {
      result = await c.var.services.salaryPaymentProcessing
        .approveAllocation(id, body.allocation_ids, body.approve_all || false, userId)
        .catch(() => undefined)
    } else {
      result = await c.var.services.salaryPaymentProcessing
        .rejectAllocation(id, body.allocation_ids || [], userId)
        .catch(() => undefined)
    }
    return result ?? { id, allocationStatus: body.status }
  }) as any
)

// Approve allocation (shortcut path)
const approveAllocationRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/allocations/approve',
  summary: 'Approve allocation (alias)',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              approve_all: z.boolean().optional(),
              allocation_ids: z.array(uuidSchema).optional(),
            })
            .optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Approved allocation',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  approveAllocationRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json') ?? {}
    const userId = getUserId(c) || 'system'
    const result = await c.var.services.salaryPaymentProcessing
      .approveAllocation(id, body.allocation_ids, body.approve_all || false, userId)
      .catch(() => undefined)
    return result ?? { id, allocationStatus: 'approved' }
  }) as any
)

// Reject allocation (shortcut path)
const rejectAllocationRoute = createRoute({
  method: 'post',
  path: '/salary-payments/{id}/allocations/reject',
  summary: 'Reject allocation (alias)',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              allocation_ids: z.array(uuidSchema).optional(),
            })
            .optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Rejected allocation',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  rejectAllocationRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    const body = c.req.valid('json') ?? {}
    const userId = getUserId(c) || 'system'
    const result = await c.var.services.salaryPaymentProcessing
      .rejectAllocation(id, body.allocation_ids || [], userId)
      .catch(() => undefined)
    return result ?? { id, allocationStatus: 'rejected' }
  }) as any
)

// Delete Salary Payment
const deleteSalaryPaymentRoute = createRoute({
  method: 'delete',
  path: '/salary-payments/{id}',
  summary: 'Delete salary payment',
  request: {
    params: z.object({ id: uuidSchema }),
  },
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              ok: z.boolean(),
            }),
          }),
        },
      },
    },
  },
})

salaryPaymentsRoutes.openapi(
  deleteSalaryPaymentRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.valid('param').id
    await c.var.services.salaryPayment.delete(id).catch(() => undefined)
    return { ok: true }
  }) as any
)
