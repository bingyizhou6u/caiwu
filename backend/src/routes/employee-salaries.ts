import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createEmployeeSalarySchema } from '../schemas/business.schema.js'

export const employeeSalariesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const employeeSalaryResponseSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  salary_type: z.string(),
  currency_id: z.string(),
  amount_cents: z.number(),
  effective_date: z.string().nullable().optional(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable().optional(),
  currency_name: z.string().nullable(),
  employee_name: z.string().nullable()
})

const listEmployeeSalariesResponseSchema = z.object({
  results: z.array(employeeSalaryResponseSchema)
})

const batchUpdateSalarySchema = z.object({
  employee_id: z.string(),
  salary_type: z.enum(['probation', 'regular']),
  salaries: z.array(z.object({
    currency_id: z.string(),
    amount_cents: z.number()
  }))
})

// Routes

// List Employee Salaries
employeeSalariesRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/employee-salaries',
    summary: 'List employee salaries',
    request: {
      query: z.object({
        employee_id: z.string(),
        salary_type: z.string().optional()
      })
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listEmployeeSalariesResponseSchema
          }
        },
        description: 'List of employee salaries'
      }
    }
  }),
  async (c) => {
    const { employee_id, salary_type } = c.req.valid('query')

    // 所有人都可以查看（通过数据权限过滤）
    // 这里假设只要能访问这个接口就可以查看指定员工的薪资，或者需要添加额外的权限检查
    // 原代码没有明确的权限检查，除了 "所有人都可以查看" 的注释

    const rows = await c.var.services.employee.listSalaries(employee_id, salary_type)

    const results = rows.map(row => ({
      id: row.salary.id,
      employee_id: row.salary.employeeId,
      salary_type: row.salary.salaryType,
      currency_id: row.salary.currencyId,
      amount_cents: row.salary.amountCents,
      effective_date: row.salary.effectiveDate,
      created_at: row.salary.createdAt,
      updated_at: row.salary.updatedAt,
      currency_name: row.currencyName,
      employee_name: row.employeeName
    }))

    return c.json({ results })
  }
)

// Create Employee Salary
employeeSalariesRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/employee-salaries',
    summary: 'Create employee salary',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createEmployeeSalarySchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: employeeSalaryResponseSchema
          }
        },
        description: 'Created employee salary'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'hr', 'salary', 'create')) throw Errors.FORBIDDEN()

    const body = c.req.valid('json')

    // Check if exists
    const existing = await c.var.services.employee.listSalaries(body.employee_id, body.salary_type)
    const found = existing.find(s => s.salary.currencyId === body.currency_id)

    let result;
    if (found) {
      result = await c.var.services.employee.updateSalary(found.salary.id, {
        amountCents: body.amount_cents
      })
      logAuditAction(c, 'update', 'employee_salary', found.salary.id, JSON.stringify(body))
    } else {
      result = await c.var.services.employee.createSalary({
        employeeId: body.employee_id,
        salaryType: body.salary_type,
        currencyId: body.currency_id,
        amountCents: body.amount_cents
      })
      logAuditAction(c, 'create', 'employee_salary', result!.salary.id, JSON.stringify(body))
    }

    if (!result) throw Errors.INTERNAL_ERROR('Failed to save salary')

    return c.json({
      id: result.salary.id,
      employee_id: result.salary.employeeId,
      salary_type: result.salary.salaryType,
      currency_id: result.salary.currencyId,
      amount_cents: result.salary.amountCents,
      effective_date: result.salary.effectiveDate,
      created_at: result.salary.createdAt,
      updated_at: result.salary.updatedAt,
      currency_name: result.currencyName,
      employee_name: result.employeeName
    })
  }
)

// Batch Update Employee Salaries
employeeSalariesRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/employee-salaries/batch',
    summary: 'Batch update employee salaries',
    request: {
      body: {
        content: {
          'application/json': {
            schema: batchUpdateSalarySchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listEmployeeSalariesResponseSchema
          }
        },
        description: 'Updated employee salaries'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'hr', 'salary', 'update')) throw Errors.FORBIDDEN()

    const body = c.req.valid('json')

    const rows = await c.var.services.employee.batchUpdateSalaries(
      body.employee_id,
      body.salary_type,
      body.salaries.map(s => ({
        currencyId: s.currency_id,
        amountCents: s.amount_cents
      }))
    )

    logAuditAction(c, 'update', 'employee_salary', body.employee_id, JSON.stringify(body))

    const results = rows.map(row => ({
      id: row.salary.id,
      employee_id: row.salary.employeeId,
      salary_type: row.salary.salaryType,
      currency_id: row.salary.currencyId,
      amount_cents: row.salary.amountCents,
      effective_date: row.salary.effectiveDate,
      created_at: row.salary.createdAt,
      updated_at: row.salary.updatedAt,
      currency_name: row.currencyName,
      employee_name: row.employeeName
    }))

    return c.json({ results })
  }
)

// Delete Employee Salary
employeeSalariesRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/employee-salaries/{id}',
    summary: 'Delete employee salary',
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
        description: 'Deleted employee salary'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'hr', 'salary', 'update')) throw Errors.FORBIDDEN()

    const { id } = c.req.valid('param')

    const deleted = await c.var.services.employee.deleteSalary(id)
    if (!deleted) throw Errors.NOT_FOUND('员工底薪记录')

    logAuditAction(c, 'delete', 'employee_salary', id, JSON.stringify(deleted))

    return c.json({ ok: true })
  }
)

