import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserEmployee, getUserId, isTeamMember } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import {
  generateAllowancePaymentsSchema,
  createAllowancePaymentSchema,
  updateAllowancePaymentSchema,
  allowancePaymentResponseSchema,
  listAllowancePaymentsResponseSchema
} from '../schemas/business.schema.js'

export const allowancePaymentsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// List Allowance Payments
allowancePaymentsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/allowance-payments',
    summary: 'List allowance payments',
    request: {
      query: z.object({
        year: z.string().optional(),
        month: z.string().optional(),
        employee_id: z.string().optional(),
        allowance_type: z.string().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listAllowancePaymentsResponseSchema
          }
        },
        description: 'List of allowance payments'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()

    const query = c.req.valid('query')
    const userId = getUserId(c)

    let employeeId = query.employee_id

    // 组员只能查看自己的补贴
    if (isTeamMember(c) && userId) {
      const { getUserEmployeeId } = await import('../utils/db.js')
      const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
      if (userEmployeeId) {
        employeeId = userEmployeeId
      } else {
        return c.json({ results: [] })
      }
    }

    const rows = await c.var.services.employee.listAllowancePayments({
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      employeeId,
      allowanceType: query.allowance_type
    })

    const results = rows.map(row => ({
      id: row.payment.id,
      employee_id: row.payment.employeeId,
      year: row.payment.year,
      month: row.payment.month,
      allowance_type: row.payment.allowanceType,
      currency_id: row.payment.currencyId,
      amount_cents: row.payment.amountCents,
      payment_date: row.payment.paymentDate,
      payment_method: row.payment.paymentMethod,
      voucher_url: row.payment.voucherUrl,
      memo: row.payment.memo,
      created_by: row.payment.createdBy,
      created_at: row.payment.createdAt,
      updated_at: row.payment.updatedAt,
      employee_name: row.employeeName,
      department_name: row.departmentName,
      currency_name: row.currencyName,
      created_by_name: row.createdByName
    }))

    return c.json({ results })
  }
)

// Generate Allowance Payments
allowancePaymentsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/allowance-payments/generate',
    summary: 'Generate allowance payments',
    request: {
      body: {
        content: {
          'application/json': {
            schema: generateAllowancePaymentsSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              created: z.number(),
              ids: z.array(z.string())
            })
          }
        },
        description: 'Generated allowance payments'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const userId = c.get('userId') as string

    const result = await c.var.services.employee.generateAllowancePayments(
      body.year,
      body.month,
      body.payment_date,
      userId
    )

    // Audit log for generated payments
    for (const id of result.ids) {
      logAuditAction(c, 'create', 'allowance_payment', id, JSON.stringify({
        year: body.year,
        month: body.month,
        generated: true
      }))
    }

    return c.json(result)
  }
)

// Create Allowance Payment
allowancePaymentsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/allowance-payments',
    summary: 'Create allowance payment',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createAllowancePaymentSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: allowancePaymentResponseSchema
          }
        },
        description: 'Created allowance payment'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')
    const userId = c.get('userId') as string

    const result = await c.var.services.employee.createAllowancePayment({
      employeeId: body.employee_id,
      year: body.year,
      month: body.month,
      allowanceType: body.allowance_type,
      currencyId: body.currency_id,
      amountCents: body.amount_cents,
      paymentDate: body.payment_date,
      paymentMethod: body.payment_method,
      voucherUrl: body.voucher_url,
      memo: body.memo,
      createdBy: userId
    })

    if (!result) throw Errors.INTERNAL_ERROR('Failed to create payment')

    logAuditAction(c, 'create', 'allowance_payment', result.payment.id, JSON.stringify(body))

    return c.json({
      id: result.payment.id,
      employee_id: result.payment.employeeId,
      year: result.payment.year,
      month: result.payment.month,
      allowance_type: result.payment.allowanceType,
      currency_id: result.payment.currencyId,
      amount_cents: result.payment.amountCents,
      payment_date: result.payment.paymentDate,
      payment_method: result.payment.paymentMethod,
      voucher_url: result.payment.voucherUrl,
      memo: result.payment.memo,
      created_by: result.payment.createdBy,
      created_at: result.payment.createdAt,
      updated_at: result.payment.updatedAt,
      employee_name: result.employeeName,
      department_name: result.departmentName,
      currency_name: result.currencyName,
      created_by_name: result.createdByName
    })
  }
)

// Update Allowance Payment
allowancePaymentsRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/allowance-payments/{id}',
    summary: 'Update allowance payment',
    request: {
      params: z.object({
        id: z.string()
      }),
      body: {
        content: {
          'application/json': {
            schema: updateAllowancePaymentSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: allowancePaymentResponseSchema
          }
        },
        description: 'Updated allowance payment'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const result = await c.var.services.employee.updateAllowancePayment(id, {
      amountCents: body.amount_cents,
      paymentDate: body.payment_date,
      paymentMethod: body.payment_method,
      voucherUrl: body.voucher_url,
      memo: body.memo
    })

    if (!result) throw Errors.NOT_FOUND('津贴支付记录')

    logAuditAction(c, 'update', 'allowance_payment', id, JSON.stringify(body))

    return c.json({
      id: result.payment.id,
      employee_id: result.payment.employeeId,
      year: result.payment.year,
      month: result.payment.month,
      allowance_type: result.payment.allowanceType,
      currency_id: result.payment.currencyId,
      amount_cents: result.payment.amountCents,
      payment_date: result.payment.paymentDate,
      payment_method: result.payment.paymentMethod,
      voucher_url: result.payment.voucherUrl,
      memo: result.payment.memo,
      created_by: result.payment.createdBy,
      created_at: result.payment.createdAt,
      updated_at: result.payment.updatedAt,
      employee_name: result.employeeName,
      department_name: result.departmentName,
      currency_name: result.currencyName,
      created_by_name: result.createdByName
    })
  }
)

// Delete Allowance Payment
allowancePaymentsRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/allowance-payments/{id}',
    summary: 'Delete allowance payment',
    request: {
      params: z.object({
        id: z.string()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        },
        description: 'Deleted allowance payment'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')

    const deleted = await c.var.services.employee.deleteAllowancePayment(id)
    if (!deleted) throw Errors.NOT_FOUND('津贴支付记录')

    logAuditAction(c, 'delete', 'allowance_payment', id, JSON.stringify(deleted))

    return c.json({ ok: true })
  }
)

