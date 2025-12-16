import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission, getUserPosition, getUserId, isTeamMember } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const allowancePaymentsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const allowancePaymentResponseSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  year: z.number(),
  month: z.number(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number(),
  paymentDate: z.string(),
  paymentMethod: z.string().nullable(),
  voucherUrl: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  employeeName: z.string().nullable().optional(),
  departmentName: z.string().nullable(),
  currencyName: z.string().nullable().optional(),
  createdByName: z.string().nullable(),
})

const generateAllowancePaymentsSchema = z.object({
  year: z.number(),
  month: z.number(),
  paymentDate: z.string(),
  employeeId: z.string().optional(),
  allowanceType: z.string().optional(),
  currencyId: z.string().optional(),
  amountCents: z.number().optional(),
  paymentMethod: z.string().optional(),
  voucherUrl: z.string().optional(),
  memo: z.string().optional(),
})

const createAllowancePaymentSchema = z.object({
  employeeId: z.string(),
  year: z.number(),
  month: z.number(),
  allowanceType: z.string().optional(),
  currencyId: z.string(),
  amountCents: z.number(),
  paymentDate: z.string(),
  paymentMethod: z.string().optional(),
  voucherUrl: z.string().optional(),
  memo: z.string().optional(),
})

const updateAllowancePaymentSchema = z.object({
  amountCents: z.number().optional(),
  paymentDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  voucherUrl: z.string().optional(),
  memo: z.string().optional(),
  allowanceType: z.string().optional(),
  employeeId: z.string().optional(),
  year: z.number().optional(),
  month: z.number().optional(),
  currencyId: z.string().optional(),
})

// 获取津贴发放列表
const listAllowancePaymentsRoute = createRoute({
  method: 'get',
  path: '/allowance-payments',
  summary: 'List allowance payments',
  request: {
    query: z.object({
      year: z.string().optional(),
      month: z.string().optional(),
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
              results: z.array(allowancePaymentResponseSchema),
            }),
          }),
        },
      },
      description: 'List of allowance payments',
    },
  },
})

allowancePaymentsRoutes.openapi(
  listAllowancePaymentsRoute,
  createRouteHandler(async (c: any) => {
    const query = c.req.valid('query')
    const userId = getUserId(c)

    let employeeId = query.employeeId

    if (isTeamMember(c) && userId) {
      employeeId = userId
    }

    const rows = await c.var.services.allowancePayment.list({
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      employeeId,
      allowanceType: query.allowanceType,
    })

    const results = rows.map((row: any) => ({
      id: row.payment.id,
      employeeId: row.payment.employeeId,
      year: row.payment.year,
      month: row.payment.month,
      allowanceType: row.payment.allowanceType,
      currencyId: row.payment.currencyId,
      amountCents: row.payment.amountCents,
      paymentDate: row.payment.paymentDate,
      paymentMethod: row.payment.paymentMethod,
      voucherUrl: row.payment.voucherUrl,
      memo: row.payment.memo,
      createdBy: row.payment.createdBy,
      createdAt: row.payment.createdAt,
      updatedAt: row.payment.updatedAt,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      currencyName: row.currencyName,
      createdByName: row.createdByName,
    }))

    return { results }
  }) as any
)

// 生成津贴发放未支付记录
const generateAllowancePaymentsRoute = createRoute({
  method: 'post',
  path: '/allowance-payments/generate',
  summary: 'Generate allowance payments',
  request: {
    body: {
      content: {
        'application/json': {
          schema: generateAllowancePaymentsSchema,
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
              created: z.number(),
              ids: z.array(z.string()),
            }),
          }),
        },
      },
      description: 'Generated allowance payments',
    },
  },
})

allowancePaymentsRoutes.openapi(generateAllowancePaymentsRoute, async (c: any) => {
  const raw = c.req.valid('json')
  const body = {
    employeeId: raw.employeeId,
    year: raw.year,
    month: raw.month,
    allowanceType: raw.allowanceType,
    currencyId: raw.currencyId,
    amountCents: raw.amountCents,
    paymentDate: raw.paymentDate,
    paymentMethod: raw.paymentMethod,
    voucherUrl: raw.voucherUrl,
    memo: raw.memo,
  }
  const userId = c.get('userId') as string

  try {
    const result = await c.var.services.allowancePayment.generate(
      body.year,
      body.month,
      body.paymentDate,
      userId
    )

    if (!result) {
      throw Errors.INTERNAL_ERROR('生成津贴支付记录失败')
    }

    for (const id of result.ids) {
      logAuditAction(
        c,
        'create',
        'allowance_payment',
        id,
        JSON.stringify({
          year: body.year,
          month: body.month,
          generated: true,
        })
      )
    }

    return result
  } catch (error: any) {
    Logger.error('Failed to generate allowance payments', { error: error?.message }, c as any)
    throw Errors.INTERNAL_ERROR('Failed to generate allowance payments')
  }
}) as any

// 创建津贴发放记录
const createAllowancePaymentRoute = createRoute({
  method: 'post',
  path: '/allowance-payments',
  summary: 'Create allowance payment',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createAllowancePaymentSchema,
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
            data: allowancePaymentResponseSchema,
          }),
        },
      },
      description: 'Created allowance payment',
    },
  },
})

allowancePaymentsRoutes.openapi(
  createAllowancePaymentRoute,
  createRouteHandler(async (c: any) => {
    const raw = c.req.valid('json')
    const body = {
      employeeId: raw.employeeId,
      year: raw.year,
      month: raw.month,
      allowanceType: raw.allowanceType,
      currencyId: raw.currencyId,
      amountCents: raw.amountCents,
      paymentDate: raw.paymentDate,
      paymentMethod: raw.paymentMethod,
      voucherUrl: raw.voucherUrl,
      memo: raw.memo,
    }
    const userId = c.get('userId') as string

    try {
      const result = await c.var.services.allowancePayment.create({
        employeeId: body.employeeId,
        year: body.year,
        month: body.month,
        allowanceType: body.allowanceType || 'other',
        currencyId: body.currencyId,
        amountCents: body.amountCents,
        paymentDate: body.paymentDate,
        paymentMethod: body.paymentMethod,
        voucherUrl: body.voucherUrl,
        memo: body.memo,
        createdBy: userId,
      })

      if (!result) {
      throw Errors.INTERNAL_ERROR('生成津贴支付记录失败')
    }

      logAuditAction(c, 'create', 'allowance_payment', result.payment.id, JSON.stringify(body))

      return {
        id: result.payment.id,
        employeeId: result.payment.employeeId,
        allowanceType: result.payment.allowanceType,
        currencyId: result.payment.currencyId,
        amountCents: result.payment.amountCents,
        year: result.payment.year,
        month: result.payment.month,
        currencyName: result.currencyName,
        employeeName: result.employeeName,
        paymentDate: result.payment.paymentDate,
        paymentMethod: result.payment.paymentMethod,
        voucherUrl: result.payment.voucherUrl,
        memo: result.payment.memo,
        createdBy: result.payment.createdBy,
        createdAt: result.payment.createdAt,
        updatedAt: result.payment.updatedAt,
        departmentName: result.departmentName,
        createdByName: result.createdByName,
      }
    } catch (error: any) {
      Logger.error('Failed to create allowance payment', { error: error?.message }, c as any)
      throw Errors.INTERNAL_ERROR('Failed to create allowance payment')
    }
  }) as any
)

// 更新津贴发放记录
const updateAllowancePaymentRoute = createRoute({
  method: 'put',
  path: '/allowance-payments/{id}',
  summary: 'Update allowance payment',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateAllowancePaymentSchema,
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
            data: allowancePaymentResponseSchema,
          }),
        },
      },
      description: 'Updated allowance payment',
    },
  },
})

allowancePaymentsRoutes.openapi(
  updateAllowancePaymentRoute,
  createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      const result = await c.var.services.allowancePayment.update(id, {
        amountCents: body.amountCents,
        paymentDate: body.paymentDate,
        paymentMethod: body.paymentMethod,
        voucherUrl: body.voucherUrl,
        memo: body.memo,
      })

      if (!result) {
      throw Errors.INTERNAL_ERROR('生成津贴支付记录失败')
    }

      logAuditAction(c, 'update', 'allowance_payment', id, JSON.stringify(body))

      return {
        id: result.payment.id,
        employeeId: result.payment.employeeId,
        allowanceType: result.payment.allowanceType,
        currencyId: result.payment.currencyId,
        amountCents: result.payment.amountCents,
        year: result.payment.year,
        month: result.payment.month,
        currencyName: result.currencyName,
        employeeName: result.employeeName,
        paymentDate: result.payment.paymentDate,
        paymentMethod: result.payment.paymentMethod,
        voucherUrl: result.payment.voucherUrl,
        memo: result.payment.memo,
        createdBy: result.payment.createdBy,
        createdAt: result.payment.createdAt,
        updatedAt: result.payment.updatedAt,
        departmentName: result.departmentName,
        createdByName: result.createdByName,
      }
    } catch (error: any) {
      Logger.error('Failed to update allowance payment', { error: error?.message }, c as any)
      throw Errors.INTERNAL_ERROR('Failed to update allowance payment')
    }
  }) as any
)

// 删除津贴发放记录
const deleteAllowancePaymentRoute = createRoute({
  method: 'delete',
  path: '/allowance-payments/{id}',
  summary: 'Delete allowance payment',
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
      description: 'Deleted allowance payment',
    },
  },
})

allowancePaymentsRoutes.openapi(
  deleteAllowancePaymentRoute,
  createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')

    await c.var.services.allowancePayment.delete(id)
    logAuditAction(c, 'delete', 'allowance_payment', id)

    return { ok: true }
  }) as any
)
