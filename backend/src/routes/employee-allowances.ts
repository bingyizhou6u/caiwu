import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import {
  batchUpdateEmployeeAllowancesSchema,
  createEmployeeAllowanceSchema,
  employeeAllowanceResponseSchema,
  listEmployeeAllowancesResponseSchema
} from '../schemas/business.schema.js'

export const employeeAllowancesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// List Employee Allowances
employeeAllowancesRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/employee-allowances',
    summary: 'List employee allowances',
    request: {
      query: z.object({
        employee_id: z.string(),
        allowance_type: z.string().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listEmployeeAllowancesResponseSchema
          }
        },
        description: 'List of employee allowances'
      }
    }
  }),
  async (c) => {
    const { employee_id, allowance_type } = c.req.valid('query')

    // 所有人都可以查看（通过数据权限过滤）
    // 这里假设只要能访问这个接口就可以查看指定员工的补贴，或者需要添加额外的权限检查

    const rows = await c.var.services.employee.listAllowances(employee_id, allowance_type)

    const results = rows.map(row => ({
      id: row.allowance.id,
      employee_id: row.allowance.employeeId,
      allowance_type: row.allowance.allowanceType,
      currency_id: row.allowance.currencyId,
      amount_cents: row.allowance.amountCents,
      created_at: row.allowance.createdAt,
      updated_at: row.allowance.updatedAt,
      currency_name: row.currencyName,
      employee_name: row.employeeName
    }))

    return c.json({ results })
  }
)

// Create Employee Allowance
employeeAllowancesRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/employee-allowances',
    summary: 'Create employee allowance',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createEmployeeAllowanceSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: employeeAllowanceResponseSchema
          }
        },
        description: 'Created employee allowance'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()

    const body = c.req.valid('json')

    // Check if exists
    const existing = await c.var.services.employee.listAllowances(body.employee_id, body.allowance_type)
    const found = existing.find(s => s.allowance.currencyId === body.currency_id)

    let result;
    if (found) {
      result = await c.var.services.employee.updateAllowance(found.allowance.id, {
        amountCents: body.amount_cents
      })
      logAuditAction(c, 'update', 'employee_allowance', found.allowance.id, JSON.stringify(body))
    } else {
      result = await c.var.services.employee.createAllowance({
        employeeId: body.employee_id,
        allowanceType: body.allowance_type,
        currencyId: body.currency_id,
        amountCents: body.amount_cents
      })
      logAuditAction(c, 'create', 'employee_allowance', result!.allowance.id, JSON.stringify(body))
    }

    if (!result) throw Errors.INTERNAL_ERROR('Failed to save allowance')

    return c.json({
      id: result.allowance.id,
      employee_id: result.allowance.employeeId,
      allowance_type: result.allowance.allowanceType,
      currency_id: result.allowance.currencyId,
      amount_cents: result.allowance.amountCents,
      created_at: result.allowance.createdAt,
      updated_at: result.allowance.updatedAt,
      currency_name: result.currencyName,
      employee_name: result.employeeName
    })
  }
)

// Batch Update Employee Allowances
employeeAllowancesRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/employee-allowances/batch',
    summary: 'Batch update employee allowances',
    request: {
      body: {
        content: {
          'application/json': {
            schema: batchUpdateEmployeeAllowancesSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listEmployeeAllowancesResponseSchema
          }
        },
        description: 'Updated employee allowances'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()

    const body = c.req.valid('json')

    const rows = await c.var.services.employee.batchUpdateAllowances(
      body.employee_id,
      body.allowance_type,
      body.allowances.map(s => ({
        currencyId: s.currency_id,
        amountCents: s.amount_cents
      }))
    )

    logAuditAction(c, 'update', 'employee_allowance', body.employee_id, JSON.stringify(body))

    const results = rows.map(row => ({
      id: row.allowance.id,
      employee_id: row.allowance.employeeId,
      allowance_type: row.allowance.allowanceType,
      currency_id: row.allowance.currencyId,
      amount_cents: row.allowance.amountCents,
      created_at: row.allowance.createdAt,
      updated_at: row.allowance.updatedAt,
      currency_name: row.currencyName,
      employee_name: row.employeeName
    }))

    return c.json({ results })
  }
)

// Delete Employee Allowance
employeeAllowancesRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/employee-allowances/{id}',
    summary: 'Delete employee allowance',
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
        description: 'Deleted employee allowance'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'allowance', 'update')) throw Errors.FORBIDDEN()

    const { id } = c.req.valid('param')

    const deleted = await c.var.services.employee.deleteAllowance(id)
    if (!deleted) throw Errors.NOT_FOUND('员工补贴记录')

    logAuditAction(c, 'delete', 'employee_allowance', id, JSON.stringify(deleted))

    return c.json({ ok: true })
  }
)

