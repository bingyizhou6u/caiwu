import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { Errors } from '../../utils/errors.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const expenseReimbursementsRoutes = new OpenAPIHono<{
  Bindings: Env
  Variables: AppVariables
}>()

/**
 * 辅助函数：检查报销权限并返回 PermissionContext
 * 如果没有权限则抛出 FORBIDDEN 错误
 */
function requireReimbursementPermission(c: any, action: string): ReturnType<typeof createPermissionContext> {
  const permCtx = createPermissionContext(c)
  if (!permCtx) {
    throw Errors.FORBIDDEN()
  }
  if (!permCtx.hasPermission('finance', 'reimbursement', action)) {
    throw Errors.FORBIDDEN()
  }
  return permCtx
}

const ReimbursementSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string().nullable().optional(),
  expenseType: z.string(),
  amountCents: z.number(),
  currencyId: z.string().nullable().optional(),
  expenseDate: z.string(),
  description: z.string(),
  voucherUrl: z.string().optional().nullable(),
  status: z.string().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedAt: z.number().optional().nullable(),
  memo: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  createdAt: z.number().optional().nullable(),
  updatedAt: z.number().optional().nullable(),
})

const CreateReimbursementSchema = z.object({
  employeeId: z.string(),
  expenseType: z.string(),
  amountCents: z.number(),
  currencyId: z.string().optional(),
  expenseDate: z.string(),
  description: z.string(),
  voucherUrl: z.string().optional(),
  memo: z.string().optional(),
})

const UpdateReimbursementStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  memo: z.string().optional(),
})

// 获取报销列表
const listExpenseReimbursementsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Expense Reimbursements'],
  summary: 'List expense reimbursements',
  request: {
    query: z.object({
      employeeId: z.string().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(ReimbursementSchema),
            }),
          }),
        },
      },
      description: 'List of expense reimbursements',
    },
  },
})

expenseReimbursementsRoutes.openapi(
  listExpenseReimbursementsRoute,
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx) {
      throw Errors.FORBIDDEN()
    }
    const { employeeId, status } = c.req.valid('query')
    const results = await c.var.services.expenseReimbursement.listReimbursements({
      employeeId,
      status,
    })
    return { results }
  })
)

// 创建报销申请
const createExpenseReimbursementRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Expense Reimbursements'],
  summary: 'Create expense reimbursement',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateReimbursementSchema,
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
            data: ReimbursementSchema,
          }),
        },
      },
      description: 'Created expense reimbursement',
    },
  },
})

expenseReimbursementsRoutes.openapi(
  createExpenseReimbursementRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireReimbursementPermission(c, 'create')

    const body = c.req.valid('json')
    const userId = c.get('employeeId')

    const newReimbursement = await c.var.services.expenseReimbursement.createReimbursement({
      ...body,
      createdBy: userId,
    })

    return newReimbursement
  }) as any
)

// 更新报销状态
const updateExpenseReimbursementStatusRoute = createRoute({
  method: 'put',
  path: '/{id}/status',
  tags: ['Expense Reimbursements'],
  summary: 'Update expense reimbursement status',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateReimbursementStatusSchema,
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
            data: z.object({ success: z.boolean() }),
          }),
        },
      },
      description: 'Updated expense reimbursement status',
    },
  },
})

expenseReimbursementsRoutes.openapi(
  updateExpenseReimbursementStatusRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireReimbursementPermission(c, 'approve')

    const { id } = c.req.valid('param')
    const { status, memo } = c.req.valid('json')
    const userId = c.get('employeeId')

    await c.var.services.expenseReimbursement.updateStatus(id, status, {
      approvedBy: userId || undefined,
      memo: memo || undefined,
    })

    return { success: true }
  }) as any
)

// 支付报销
const payExpenseReimbursementRoute = createRoute({
  method: 'post',
  path: '/{id}/pay',
  tags: ['Expense Reimbursements'],
  summary: 'Pay expense reimbursement',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ success: z.boolean() }),
          }),
        },
      },
      description: 'Paid expense reimbursement',
    },
  },
})

expenseReimbursementsRoutes.openapi(
  payExpenseReimbursementRoute,
  createRouteHandler(async (c: any) => {
    // 使用 PermissionContext 检查权限
    requireReimbursementPermission(c, 'pay')

    const { id } = c.req.valid('param')

    await c.var.services.expenseReimbursement.payReimbursement(id)

    return { success: true }
  }) as any
)
