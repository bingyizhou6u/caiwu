import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'

export const employeeAllowancesRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schema 定义
const employeeAllowanceResponseSchema = z.object({
  // 兼容蛇形输出
  id: z.string(),
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number(),
  currencyName: z.string().nullable(),
  employeeName: z.string().nullable()
})

const listEmployeeAllowancesResponseSchema = z.object({
  results: z.array(employeeAllowanceResponseSchema)
})

const createEmployeeAllowanceSchema = z.object({
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number()
})

const batchUpdateEmployeeAllowancesSchema = z.object({
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  allowances: z.array(z.object({
    currencyId: z.string(),
    amountCents: z.number()
  }))
})

// 获取员工津贴列表
employeeAllowancesRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/employee-allowances',
    summary: 'List employee allowances',
    request: {
      query: z.object({
        employeeId: z.string().optional(),
        allowanceType: z.string().optional()
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
    const { employeeId, allowanceType } = c.req.valid('query')


    const rows = await c.var.services.allowance.list(
      employeeId || '',
      allowanceType
    )

    const results = rows.map((row: any) => ({
      id: row.allowance.id,
      employeeId: row.allowance.employeeId,
      allowanceType: row.allowance.allowanceType,
      currencyId: row.allowance.currencyId,
      amountCents: row.allowance.amountCents,
      currencyName: row.currencyName,
      employeeName: row.employeeName
    }))

    return c.json({ results })
  }
)

// 创建员工津贴
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
    const raw = c.req.valid('json')
    const body = {
      employeeId: raw.employeeId,
      allowanceType: raw.allowanceType,
      currencyId: raw.currencyId,
      amountCents: raw.amountCents
    }


    try {
      const result = await c.var.services.allowance.create({
        employeeId: body.employeeId,
        allowanceType: body.allowanceType || 'other',
        currencyId: body.currencyId,
        amountCents: body.amountCents
      })

      if (!result) throw Errors.INTERNAL_ERROR('Failed to save allowance')

      return c.json({
        id: result.allowance.id,
        employeeId: result.allowance.employeeId,
        allowanceType: result.allowance.allowanceType,
        currencyId: result.allowance.currencyId,
        amountCents: result.allowance.amountCents,
        currencyName: result.currencyName,
        employeeName: result.employeeName
      })
    } catch {
      console.error('Failed to create allowance')
      throw Errors.INTERNAL_ERROR('Failed to create allowance')
    }
  }
)

// 批量更新员工津贴
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
    const body = c.req.valid('json')

    try {
      const rows = await c.var.services.allowance.batchUpdate(
        body.employeeId,
        body.allowanceType ?? (body as any).allowance_type,
        (body.allowances || []).map((s: any) => ({
          currencyId: s.currencyId,
          amountCents: s.amountCents
        }))
      )

      logAuditAction(c, 'update', 'employee_allowance', body.employeeId, JSON.stringify(body))

      const results = rows.map((row: any) => ({
        id: row.allowance.id,
        employeeId: row.allowance.employeeId,
        allowanceType: row.allowance.allowanceType,
        currencyId: row.allowance.currencyId,
        amountCents: row.allowance.amountCents,
        currencyName: row.currencyName,
        employeeName: row.employeeName
      }))

      return c.json({ results })
    } catch {
      console.error('Failed to batch update allowances')
      throw Errors.INTERNAL_ERROR('Failed to batch update allowances')
    }
  }
)

// 删除员工津贴
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
    const { id } = c.req.valid('param')

    await c.var.services.allowance.delete(id)
    logAuditAction(c, 'delete', 'employee_allowance', id)
    return c.json({ ok: true })
  }
)
