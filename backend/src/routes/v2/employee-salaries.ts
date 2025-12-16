import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const employeeSalariesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const employeeSalaryResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  salaryType: z.string(),
  currencyId: z.string(),
  amountCents: z.number(),
  currencyName: z.string().nullable(),
  employeeName: z.string().nullable(),
})

const createEmployeeSalarySchema = z.object({
  employeeId: z.string(),
  salaryType: z.enum(['probation', 'regular']).optional(),
  currencyId: z.string(),
  amountCents: z.number(),
})

const batchUpdateSalarySchema = z.object({
  employeeId: z.string(),
  salaryType: z.enum(['probation', 'regular']).optional(),
  salaries: z.array(
    z.object({
      currencyId: z.string(),
      amountCents: z.number(),
    })
  ),
})

// 获取员工薪资列表
const listEmployeeSalariesRoute = createRoute({
  method: 'get',
  path: '/employee-salaries',
  summary: 'List employee salaries',
  request: {
    query: z.object({
      employeeId: z.string(),
      salaryType: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(employeeSalaryResponseSchema),
            }),
          }),
        },
      },
      description: 'List of employee salaries',
    },
  },
})

employeeSalariesRoutes.openapi(
  listEmployeeSalariesRoute,
  createRouteHandler(async (c: any) => {
    const { employeeId, salaryType } = c.req.valid('query')

    const rows = await c.var.services.salary.list(employeeId, salaryType)

    const results = rows.map((row: any) => ({
      id: row.salary.id,
      employeeId: row.salary.employeeId,
      salaryType: row.salary.salaryType,
      currencyId: row.salary.currencyId,
      amountCents: row.salary.amountCents,
      currencyName: row.currencyName,
      employeeName: row.employeeName,
    }))

    return { results }
  }) as any
)

// 创建员工薪资
const createEmployeeSalaryRoute = createRoute({
  method: 'post',
  path: '/employee-salaries',
  summary: 'Create employee salary',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createEmployeeSalarySchema,
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
            data: employeeSalaryResponseSchema,
          }),
        },
      },
      description: 'Created employee salary',
    },
  },
})

employeeSalariesRoutes.openapi(
  createEmployeeSalaryRoute,
  createRouteHandler(async (c: any) => {
    const raw = c.req.valid('json')
    const body = {
      employeeId: raw.employeeId,
      salaryType: raw.salaryType,
      currencyId: raw.currencyId,
      amountCents: raw.amountCents,
    }

    try {
      const result = await c.var.services.salary.create({
        employeeId: body.employeeId,
        salaryType: body.salaryType || 'regular',
        currencyId: body.currencyId,
        amountCents: body.amountCents,
      })

      if (!result) {
      throw Errors.INTERNAL_ERROR('Failed to save salary')}

      return {
        id: result.salary.id,
        employeeId: result.salary.employeeId,
        salaryType: result.salary.salaryType,
        currencyId: result.salary.currencyId,
        amountCents: result.salary.amountCents,
        currencyName: result.currencyName,
        employeeName: result.employeeName,
      }
    } catch {
      console.error('Failed to create salary')
      throw Errors.INTERNAL_ERROR('Failed to create salary')
    }
  }) as any
)

// 批量更新员工薪资
const batchUpdateSalaryRoute = createRoute({
  method: 'put',
  path: '/employee-salaries/batch',
  summary: 'Batch update employee salaries',
  request: {
    body: {
      content: {
        'application/json': {
          schema: batchUpdateSalarySchema,
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
            data: z.object({
              results: z.array(employeeSalaryResponseSchema),
            }),
          }),
        },
      },
      description: 'Updated employee salaries',
    },
  },
})

employeeSalariesRoutes.openapi(
  batchUpdateSalaryRoute,
  createRouteHandler(async (c: any) => {
    const body = c.req.valid('json')

    try {
      const rows = await c.var.services.salary.batchUpdate(
        body.employeeId,
        body.salaryType || 'regular',
        (body.salaries || []).map((s: any) => ({
          currencyId: s.currencyId,
          amountCents: s.amountCents,
        }))
      )

      logAuditAction(c, 'update', 'employee_salary', body.employeeId, JSON.stringify(body))

      const results = rows.map((row: any) => ({
        id: row.salary.id,
        employeeId: row.salary.employeeId,
        salaryType: row.salary.salaryType,
        currencyId: row.salary.currencyId,
        amountCents: row.salary.amountCents,
        currencyName: row.currencyName,
        employeeName: row.employeeName,
      }))

      return { results }
    } catch {
      console.error('Failed to batch update salaries')
      throw Errors.INTERNAL_ERROR('Failed to batch update salaries')
    }
  }) as any
)

// 删除员工薪资
const deleteEmployeeSalaryRoute = createRoute({
  method: 'delete',
  path: '/employee-salaries/{id}',
  summary: 'Delete employee salary',
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
            data: z.object({ ok: z.boolean() }),
          }),
        },
      },
      description: 'Deleted employee salary',
    },
  },
})

employeeSalariesRoutes.openapi(
  deleteEmployeeSalaryRoute,
  createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')

    await c.var.services.salary.delete(id).catch(() => undefined)
    logAuditAction(c, 'delete', 'employee_salary', id)
    return { ok: true }
  }) as any
)
