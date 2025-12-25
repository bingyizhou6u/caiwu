import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const employeeAllowancesRoutes = new OpenAPIHono<{
  Bindings: Env
  Variables: AppVariables
}>()

// Schema 定义
const employeeAllowanceResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number(),
  currencyName: z.string().nullable(),
  employeeName: z.string().nullable(),
})

const createEmployeeAllowanceSchema = z.object({
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number(),
})

const batchUpdateEmployeeAllowancesSchema = z.object({
  employeeId: z.string(),
  allowanceType: z.string().optional(),
  allowances: z.array(
    z.object({
      currencyId: z.string(),
      amountCents: z.number(),
    })
  ),
})

// 获取员工津贴列表
const listEmployeeAllowancesRoute = createRoute({
  method: 'get',
  path: '/employee-allowances',
  summary: 'List employee allowances',
  request: {
    query: z.object({
      employeeId: z.string().optional(),
      allowanceType: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(employeeAllowanceResponseSchema),
            }),
          }),
        },
      },
      description: 'List of employee allowances',
    },
  },
})

employeeAllowancesRoutes.openapi(
  listEmployeeAllowancesRoute,
  createRouteHandler(async (c: any) => {
    const { employeeId, allowanceType } = c.req.valid('query')

    const rows = await c.var.services.allowance.list(employeeId || '', allowanceType)

    const results = rows.map((row: any) => ({
      id: row.allowance.id,
      employeeId: row.allowance.employeeId,
      allowanceType: row.allowance.allowanceType,
      currencyId: row.allowance.currencyId,
      amountCents: row.allowance.amountCents,
      currencyName: row.currencyName,
      employeeName: row.employeeName,
    }))

    return { results }
  }) as any
)

// 创建员工津贴
const createEmployeeAllowanceRoute = createRoute({
  method: 'post',
  path: '/employee-allowances',
  summary: 'Create employee allowance',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createEmployeeAllowanceSchema,
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
            data: employeeAllowanceResponseSchema,
          }),
        },
      },
      description: 'Created employee allowance',
    },
  },
})

employeeAllowancesRoutes.openapi(
  createEmployeeAllowanceRoute,
  createRouteHandler(async (c: any) => {
    const raw = c.req.valid('json')
    const body = {
      employeeId: raw.employeeId,
      allowanceType: raw.allowanceType,
      currencyId: raw.currencyId,
      amountCents: raw.amountCents,
    }

    try {
      const result = await c.var.services.allowance.create({
        employeeId: body.employeeId,
        allowanceType: body.allowanceType || 'other',
        currencyId: body.currencyId,
        amountCents: body.amountCents,
      })

      if (!result) {
      throw Errors.INTERNAL_ERROR('Failed to save allowance')}

      return {
        id: result.allowance.id,
        employeeId: result.allowance.employeeId,
        allowanceType: result.allowance.allowanceType,
        currencyId: result.allowance.currencyId,
        amountCents: result.allowance.amountCents,
        currencyName: result.currencyName,
        employeeName: result.employeeName,
      }
    } catch (error: any) {
      Logger.error('Failed to create allowance', { error: error?.message }, c as any)
      throw Errors.INTERNAL_ERROR('Failed to create allowance')
    }
  }) as any
)

// 批量更新员工津贴
const batchUpdateEmployeeAllowancesRoute = createRoute({
  method: 'put',
  path: '/employee-allowances/batch',
  summary: 'Batch update employee allowances',
  request: {
    body: {
      content: {
        'application/json': {
          schema: batchUpdateEmployeeAllowancesSchema,
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
              results: z.array(employeeAllowanceResponseSchema),
            }),
          }),
        },
      },
      description: 'Updated employee allowances',
    },
  },
})

employeeAllowancesRoutes.openapi(
  batchUpdateEmployeeAllowancesRoute,
  createRouteHandler(async (c: any) => {
    const body = c.req.valid('json')

    try {
      const rows = await c.var.services.allowance.batchUpdate(
        body.employeeId,
        body.allowanceType ?? (body as { allowance_type?: string }).allowance_type,
        (body.allowances || []).map((s: any) => ({
          currencyId: s.currencyId,
          amountCents: s.amountCents,
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
        employeeName: row.employeeName,
      }))

      return { results }
    } catch {
      Logger.error('Failed to batch update allowances', {}, c as any)
      throw Errors.INTERNAL_ERROR('Failed to batch update allowances')
    }
  }) as any
)

// 删除员工津贴
const deleteEmployeeAllowanceRoute = createRoute({
  method: 'delete',
  path: '/employee-allowances/{id}',
  summary: 'Delete employee allowance',
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
      description: 'Deleted employee allowance',
    },
  },
})

employeeAllowancesRoutes.openapi(
  deleteEmployeeAllowanceRoute,
  createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')

    await c.var.services.allowance.delete(id)
    logAuditAction(c, 'delete', 'employee_allowance', id)
    return { ok: true }
  }) as any
)
