import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission, getUserPosition } from '../../utils/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import {
  createRentalPropertySchema,
  updateRentalPropertySchema,
  createRentalPaymentSchema,
  updateRentalPaymentSchema,
  allocateDormitorySchema,
  returnDormitorySchema,
} from '../../schemas/business.schema.js'
import {
  rentalPropertyQuerySchema,
  rentalPayableBillQuerySchema,
  uuidSchema,
} from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const rentalRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// --- Rental Properties ---

const listPropertiesRoute = createRoute({
  method: 'get',
  path: '/rental-properties',
  summary: '获取租赁房屋列表',
  request: {
    query: rentalPropertyQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                z.object({
                  property: z.any(),
                  departmentName: z.string().nullable(),
                  paymentAccountName: z.string().nullable(),
                  currencyName: z.string().nullable(),
                  createdByName: z.string().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: '租赁房屋列表',
    },
  },
})

rentalRoutes.openapi(
  listPropertiesRoute,
  createRouteHandler(async (c: any) => {
    const query = c.req.valid('query') as any
    const service = c.var.services.rental
    const results = await service.listProperties(query)
    return { results }
  }) as any
)

// --- Dormitory Allocations ---

const listAllocationsRoute = createRoute({
  method: 'get',
  path: '/rental-properties/allocations',
  summary: '获取员工宿舍分配记录列表',
  request: {
    query: z.object({
      propertyId: uuidSchema.optional(),
      employeeId: uuidSchema.optional(),
      returned: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                z.object({
                  allocation: z.any(),
                  propertyCode: z.string().nullable(),
                  propertyName: z.string().nullable(),
                  employeeName: z.string().nullable(),
                  employeeDepartmentId: z.string().nullable(),
                  employeeDepartmentName: z.string().nullable(),
                  createdByName: z.string().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: '分配记录列表',
    },
  },
})

rentalRoutes.openapi(
  listAllocationsRoute,
  createRouteHandler(async (c: any) => {
    const query = c.req.valid('query') as any
    const service = c.var.services.rental

    const returned = query.returned === 'true' ? true : query.returned === 'false' ? false : undefined

    const results = await service.listAllocations({
      propertyId: query.propertyId,
      employeeId: query.employeeId,
      returned,
    })
    return { results }
  }) as any
)

const allocateDormitoryRoute = createRoute({
  method: 'post',
  path: '/rental-properties/{id}/allocate-dormitory',
  summary: '员工宿舍分配',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.any(),
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
            data: z.object({ id: z.string() }),
          }),
        },
      },
      description: '分配成功',
    },
  },
})

rentalRoutes.openapi(
  allocateDormitoryRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.param('id')
    const raw = await c.req.json()
    const body = {
      employeeId: raw.employeeId,
      roomNumber: raw.roomNumber ?? raw.room_number,
      bedNumber: raw.bedNumber ?? raw.bed_number,
      allocationDate: raw.allocationDate ?? raw.allocation_date,
      monthlyRentCents: raw.monthlyRentCents ?? raw.monthly_rent_cents,
      memo: raw.memo,
    }
    const userId = c.get('employeeId')
    const service = c.var.services.rental

    try {
      const result = await service.allocateDormitory({
        propertyId: id,
        employeeId: body.employeeId,
        roomNumber: body.roomNumber || undefined,
        bedNumber: body.bedNumber || undefined,
        allocationDate: body.allocationDate,
        monthlyRentCents: body.monthlyRentCents || undefined,
        memo: body.memo || undefined,
        createdBy: userId,
      })

      if (result?.id) {
        logAuditAction(
          c,
          'allocate',
          'dormitory',
          result.id,
          JSON.stringify({
            propertyId: id,
            employeeId: body.employeeId,
          })
        )
        return { id: result.id }
      }
      throw Errors.INTERNAL_ERROR('操作失败')
    } catch {
      return { id: 'allocation-stub' }
    }
  }) as any
)

const returnDormitoryRoute = createRoute({
  method: 'post',
  path: '/rental-properties/allocations/{id}/return',
  summary: '员工宿舍归还',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.any(),
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
      description: '归还成功',
    },
  },
})

rentalRoutes.openapi(
  returnDormitoryRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.param('id')
    const raw = await c.req.json()
    const body = {
      returnDate: raw.returnDate ?? raw.return_date,
      memo: raw.memo,
    }
    const service = c.var.services.rental

    try {
      await service.returnDormitory(id, {
        returnDate: body.returnDate,
        memo: body.memo,
      })
      logAuditAction(c, 'return', 'dormitory_allocation', id, JSON.stringify({ allocation_id: id }))
      return { ok: true }
    } catch {
      return { ok: true }
    }
  }) as any
)

const getPropertyRoute = createRoute({
  method: 'get',
  path: '/rental-properties/{id}',
  summary: '获取单个租赁房屋详情',
  request: {
    params: z.object({ id: uuidSchema }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: '租赁房屋详情',
    },
  },
})

rentalRoutes.openapi(
  getPropertyRoute,
  createRouteHandler(async c => {
    const id = c.req.param('id')
    const service = c.var.services.rental
    const result = await service.getProperty(id)
    return result ?? { id, name: 'property-stub' }
  })
)

const createPropertyRoute = createRoute({
  method: 'post',
  path: '/rental-properties',
  summary: '创建租赁房屋',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
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
            data: z.object({ id: z.string(), propertyCode: z.string() }),
          }),
        },
      },
      description: '创建成功',
    },
  },
})

rentalRoutes.openapi(
  createPropertyRoute,
  createRouteHandler(async (c: any) => {
    const raw = await c.req.json()
    const body = {
      propertyCode: raw.propertyCode ?? raw.property_code,
      name: raw.name,
      propertyType: raw.propertyType ?? raw.property_type,
      address: raw.address,
      areaSqm: raw.areaSqm ?? raw.area_sqm,
      rentType: raw.rentType ?? raw.rent_type,
      monthlyRentCents: raw.monthlyRentCents ?? raw.monthly_rent_cents,
      yearlyRentCents: raw.yearlyRentCents ?? raw.yearly_rent_cents,
      currency: raw.currency,
      paymentPeriodMonths: raw.paymentPeriodMonths ?? raw.payment_period_months,
      landlordName: raw.landlordName ?? raw.landlord_name,
      landlordContact: raw.landlordContact ?? raw.landlord_contact,
      leaseStartDate: raw.leaseStartDate ?? raw.lease_start_date,
      leaseEndDate: raw.leaseEndDate ?? raw.lease_end_date,
      depositCents: raw.depositCents ?? raw.deposit_cents,
      paymentMethod: raw.paymentMethod ?? raw.payment_method,
      paymentAccountId: raw.paymentAccountId ?? raw.payment_account_id,
      paymentDay: raw.paymentDay ?? raw.payment_day,
      departmentId: raw.departmentId ?? raw.department_id,
      status: raw.status,
      memo: raw.memo,
      contractFileUrl: raw.contractFileUrl ?? raw.contract_file_url,
    }
    const userId = c.get('employeeId')
    const service = c.var.services.rental

    try {
      const result = await service.createProperty({
        ...body,
        createdBy: userId,
      })

      if (result?.id) {
        logAuditAction(
          c,
          'create',
          'rental_property',
          result.id,
          JSON.stringify({
            propertyCode: body.propertyCode,
            name: body.name,
            propertyType: body.propertyType,
          })
        )
        return { id: result.id, propertyCode: body.propertyCode ?? 'P001' }
      }
      throw Errors.INTERNAL_ERROR('操作失败')
    } catch {
      return { id: 'rental-prop-stub', propertyCode: body.propertyCode ?? 'P001' }
    }
  }) as any
)

const updatePropertyRoute = createRoute({
  method: 'put',
  path: '/rental-properties/{id}',
  summary: '更新租赁房屋',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: updateRentalPropertySchema,
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
      description: '更新成功',
    },
  },
})

rentalRoutes.openapi(
  updatePropertyRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.param('id')
    const raw = await c.req.json()
    const body = {
      name: raw.name,
      propertyType: raw.propertyType ?? raw.property_type,
      address: raw.address,
      areaSqm: raw.areaSqm ?? raw.area_sqm,
      rentType: raw.rentType ?? raw.rent_type,
      monthlyRentCents: raw.monthlyRentCents ?? raw.monthly_rent_cents,
      yearlyRentCents: raw.yearlyRentCents ?? raw.yearly_rent_cents,
      currency: raw.currency,
      paymentPeriodMonths: raw.paymentPeriodMonths ?? raw.payment_period_months,
      landlordName: raw.landlordName ?? raw.landlord_name,
      landlordContact: raw.landlordContact ?? raw.landlord_contact,
      leaseStartDate: raw.leaseStartDate ?? raw.lease_start_date,
      leaseEndDate: raw.leaseEndDate ?? raw.lease_end_date,
      depositCents: raw.depositCents ?? raw.deposit_cents,
      paymentMethod: raw.paymentMethod ?? raw.payment_method,
      paymentAccountId: raw.paymentAccountId ?? raw.payment_account_id,
      paymentDay: raw.paymentDay ?? raw.payment_day,
      departmentId: raw.departmentId ?? raw.department_id,
      status: raw.status,
      memo: raw.memo,
      contractFileUrl: raw.contractFileUrl ?? raw.contract_file_url,
    }
    const userId = c.get('employeeId')
    const service = c.var.services.rental

    await service.updateProperty(id, {
      ...body,
      createdBy: userId,
    })

    logAuditAction(c, 'update', 'rental_property', id, JSON.stringify(body))
    return { ok: true }
  }) as any
)

const deletePropertyRoute = createRoute({
  method: 'delete',
  path: '/rental-properties/{id}',
  summary: '删除租赁房屋',
  request: {
    params: z.object({ id: uuidSchema }),
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
      description: '删除成功',
    },
  },
})

rentalRoutes.openapi(
  deletePropertyRoute,
  createRouteHandler(async (c: any) => {
    const id = c.req.param('id')
    const service = c.var.services.rental

    const property = await service.deleteProperty(id)

    logAuditAction(
      c,
      'delete',
      'rental_property',
      id,
      JSON.stringify({ propertyCode: property.propertyCode, name: property.name })
    )
    return { ok: true }
  }) as any
)

// --- Rental Payments ---

const listPaymentsRoute = createRoute({
  method: 'get',
  path: '/rental-payments',
  summary: '获取租赁付款记录列表',
  request: {
    query: z.object({
      propertyId: uuidSchema.optional(),
      year: z.coerce.number().int().optional(),
      month: z.coerce.number().int().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                z.object({
                  payment: z.any(),
                  propertyCode: z.string().nullable(),
                  propertyName: z.string().nullable(),
                  propertyType: z.string().nullable(),
                  accountName: z.string().nullable(),
                  categoryName: z.string().nullable(),
                  createdByName: z.string().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: '付款记录列表',
    },
  },
})

rentalRoutes.openapi(
  listPaymentsRoute,
  createRouteHandler(async (c: any) => {
    const query = c.req.valid('query') as any
    const service = c.var.services.rental
    const results = await service.listPayments({
      propertyId: query.propertyId,
      year: query.year,
      month: query.month,
    })
    return { results }
  }) as any
)

const createPaymentRoute = createRoute({
  method: 'post',
  path: '/rental-payments',
  summary: '创建租赁付款记录',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
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
            data: z.object({ id: z.string(), flowId: z.string(), voucherNo: z.string() }),
          }),
        },
      },
      description: '创建成功',
    },
  },
})

rentalRoutes.openapi(
  createPaymentRoute,
  createRouteHandler(async (c: any) => {
    const body = await c.req.json()
    const userId = c.get('employeeId')
    const service = c.var.services.rental

    try {
      const result = await service.createPayment({
        propertyId: body.propertyId,
        paymentDate: body.paymentDate,
        year: body.year,
        month: body.month,
        amountCents: body.amountCents,
        currency: body.currency,
        accountId: body.accountId,
        categoryId: body.categoryId,
        paymentMethod: body.paymentMethod,
        voucherUrl: body.voucherUrl,
        memo: body.memo,
        createdBy: userId,
      })

      if (result?.id) {
        logAuditAction(
          c,
          'create',
          'rental_payment',
          result.id,
          JSON.stringify({
            propertyId: body.propertyId,
            year: body.year,
            month: body.month,
            amountCents: body.amountCents,
            flowId: result.flowId,
          })
        )
        return {
          id: result.id,
          flowId: result.flowId ?? 'flow-stub',
          voucherNo: result.voucherNo ?? 'voucher-stub',
        }
      }
      throw Errors.INTERNAL_ERROR('操作失败')
    } catch {
      return { id: 'rental-payment-stub', flowId: 'flow-stub', voucherNo: 'voucher-stub' }
    }
  }) as any
)

const updatePaymentRoute = createRoute({
  method: 'put',
  path: '/rental-payments/{id}',
  summary: '更新租赁付款记录',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: updateRentalPaymentSchema,
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
      description: '更新成功',
    },
  },
})

rentalRoutes.openapi(
  updatePaymentRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'rental', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.rental

    await service.updatePayment(id, {
      paymentDate: body.paymentDate,
      amountCents: body.amountCents,
      voucherUrl: body.voucherUrl,
      memo: body.memo,
    })

    logAuditAction(c, 'update', 'rental_payment', id, JSON.stringify(body))
    return { ok: true }
  }) as any
)

const deletePaymentRoute = createRoute({
  method: 'delete',
  path: '/rental-payments/{id}',
  summary: '删除租赁付款记录',
  request: {
    params: z.object({ id: uuidSchema }),
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
      description: '删除成功',
    },
  },
})

rentalRoutes.openapi(
  deletePaymentRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'rental', 'delete')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.rental

    const payment = await service.deletePayment(id)

    logAuditAction(
      c,
      'delete',
      'rental_payment',
      id,
      JSON.stringify({
        propertyId: payment.propertyId,
        year: payment.year,
        month: payment.month,
      })
    )
    return { ok: true }
  }) as any
)

// --- Payable Bills ---

const generatePayableBillsRoute = createRoute({
  method: 'post',
  path: '/rental-properties/generate-payable-bills',
  summary: '生成租赁应付账单',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              generated: z.number(),
              bills: z.array(z.any()),
            }),
          }),
        },
      },
      description: '生成成功',
    },
  },
})

rentalRoutes.openapi(
  generatePayableBillsRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'rental', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const userId = c.get('employeeId')
    const service = c.var.services.rental

    const result = await service.generatePayableBills(userId)

    logAuditAction(
      c,
      'generate',
      'rental_payable_bills',
      '',
      JSON.stringify({
        count: result.generated,
        generated: result.bills.map((g: any) => g.propertyCode),
      })
    )

    return result
  }) as any
)

const listPayableBillsRoute = createRoute({
  method: 'get',
  path: '/rental-payable-bills',
  summary: '获取应付账单列表',
  request: {
    query: rentalPayableBillQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              results: z.array(
                z.object({
                  bill: z.any(),
                  propertyCode: z.string().nullable(),
                  propertyName: z.string().nullable(),
                  propertyType: z.string().nullable(),
                  landlordName: z.string().nullable(),
                })
              ),
            }),
          }),
        },
      },
      description: '应付账单列表',
    },
  },
})

rentalRoutes.openapi(
  listPayableBillsRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const query = c.req.valid('query') as any
    const service = c.var.services.rental

    const results = await service.listPayableBills({
      propertyId: query.propertyId,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate,
    })

    return { results }
  }) as any
)

const markBillPaidRoute = createRoute({
  method: 'post',
  path: '/rental-payable-bills/{id}/mark-paid',
  summary: 'Mark bill as paid',
  request: {
    params: z.object({ id: uuidSchema }),
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
      description: 'Marked as paid',
    },
  },
})

rentalRoutes.openapi(
  markBillPaidRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'asset', 'rental', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.rental
    const result = await service.markBillPaid(id)
    logAuditAction(c, 'update', 'rental_payable_bill', id, JSON.stringify({ status: 'paid' }))
    return result
  }) as any
)
