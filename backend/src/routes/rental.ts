import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import {
  createRentalPropertySchema,
  updateRentalPropertySchema,
  createRentalPaymentSchema,
  updateRentalPaymentSchema,
  allocateDormitorySchema,
  returnDormitorySchema
} from '../schemas/business.schema.js'
import {
  rentalPropertyQuerySchema,
  rentalPayableBillQuerySchema,
  uuidSchema
} from '../schemas/common.schema.js'

export const rentalRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// --- Rental Properties ---

const listPropertiesRoute = createRoute({
  method: 'get',
  path: '/rental-properties',
  summary: '获取租赁房屋列表',
  request: {
    query: rentalPropertyQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.object({
              property: z.any(),
              departmentName: z.string().nullable(),
              paymentAccountName: z.string().nullable(),
              currencyName: z.string().nullable(),
              createdByName: z.string().nullable()
            }))
          })
        }
      },
      description: '租赁房屋列表'
    }
  }
})

rentalRoutes.openapi(listPropertiesRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = c.req.valid('query')
  const service = c.get('services').rental
  const results = await service.listProperties(query)
  return c.json({ results })
})

// --- Dormitory Allocations ---

const listAllocationsRoute = createRoute({
  method: 'get',
  path: '/rental-properties/allocations',
  summary: '获取员工宿舍分配记录列表',
  request: {
    query: z.object({
      property_id: uuidSchema.optional(),
      employee_id: uuidSchema.optional(),
      returned: z.enum(['true', 'false']).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.object({
              allocation: z.any(),
              propertyCode: z.string().nullable(),
              propertyName: z.string().nullable(),
              employeeName: z.string().nullable(),
              employeeDepartmentId: z.string().nullable(),
              employeeDepartmentName: z.string().nullable(),
              createdByName: z.string().nullable()
            }))
          })
        }
      },
      description: '分配记录列表'
    }
  }
})

rentalRoutes.openapi(listAllocationsRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = c.req.valid('query')
  const service = c.get('services').rental

  const returned = query.returned === 'true' ? true : (query.returned === 'false' ? false : undefined)

  const results = await service.listAllocations({
    propertyId: query.property_id,
    employeeId: query.employee_id,
    returned
  })
  return c.json({ results })
})

const allocateDormitoryRoute = createRoute({
  method: 'post',
  path: '/rental-properties/{id}/allocate-dormitory',
  summary: '员工宿舍分配',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: allocateDormitorySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.string() })
        }
      },
      description: '分配成功'
    }
  }
})

rentalRoutes.openapi(allocateDormitoryRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const userId = c.get('userId')
  const service = c.get('services').rental

  const result = await service.allocateDormitory({
    propertyId: id,
    employeeId: body.employee_id,
    roomNumber: body.room_number || undefined,
    bedNumber: body.bed_number || undefined,
    allocationDate: body.allocation_date,
    monthlyRentCents: body.monthly_rent_cents || undefined,
    memo: body.memo || undefined,
    createdBy: userId
  })

  logAuditAction(c, 'allocate', 'dormitory', result.id, JSON.stringify({
    property_id: id,
    employee_id: body.employee_id
  }))

  return c.json({ id: result.id })
})

const returnDormitoryRoute = createRoute({
  method: 'post',
  path: '/rental-properties/allocations/{id}/return',
  summary: '员工宿舍归还',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: returnDormitorySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: '归还成功'
    }
  }
})

rentalRoutes.openapi(returnDormitoryRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const service = c.get('services').rental

  await service.returnDormitory(id, {
    returnDate: body.return_date,
    memo: body.memo
  })

  logAuditAction(c, 'return', 'dormitory_allocation', id, JSON.stringify({ allocation_id: id }))
  return c.json({ ok: true })
})

const getPropertyRoute = createRoute({
  method: 'get',
  path: '/rental-properties/{id}',
  summary: '获取单个租赁房屋详情',
  request: {
    params: z.object({ id: uuidSchema })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any() // TODO: Define detailed response schema
        }
      },
      description: '租赁房屋详情'
    }
  }
})

rentalRoutes.openapi(getPropertyRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').rental
  const result = await service.getProperty(id)
  return c.json(result)
})

const createPropertyRoute = createRoute({
  method: 'post',
  path: '/rental-properties',
  summary: '创建租赁房屋',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createRentalPropertySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), property_code: z.string() })
        }
      },
      description: '创建成功'
    }
  }
})

rentalRoutes.openapi(createPropertyRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'create')) throw Errors.FORBIDDEN()
  const body = c.req.valid('json')
  // console.error('Create Property Body:', JSON.stringify(body, null, 2))
  const userId = c.get('userId')
  const service = c.get('services').rental

  const result = await service.createProperty({
    propertyCode: body.property_code,
    name: body.name,
    propertyType: body.property_type,
    address: body.address,
    areaSqm: body.area_sqm,
    rentType: body.rent_type,
    monthlyRentCents: body.monthly_rent_cents,
    yearlyRentCents: body.yearly_rent_cents,
    currency: body.currency,
    paymentPeriodMonths: body.payment_period_months,
    landlordName: body.landlord_name,
    landlordContact: body.landlord_contact,
    leaseStartDate: body.lease_start_date,
    leaseEndDate: body.lease_end_date,
    depositCents: body.deposit_cents,
    paymentMethod: body.payment_method,
    paymentAccountId: body.payment_account_id,
    paymentDay: body.payment_day,
    departmentId: body.department_id,

    status: body.status,
    memo: body.memo,
    contractFileUrl: body.contract_file_url,
    createdBy: userId
  })

  logAuditAction(c, 'create', 'rental_property', result.id, JSON.stringify({
    property_code: body.property_code,
    name: body.name,
    property_type: body.property_type
  }))

  return c.json({ id: result.id, property_code: body.property_code })
})

const updatePropertyRoute = createRoute({
  method: 'put',
  path: '/rental-properties/{id}',
  summary: '更新租赁房屋',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: updateRentalPropertySchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: '更新成功'
    }
  }
})

rentalRoutes.openapi(updatePropertyRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const userId = c.get('userId')
  const service = c.get('services').rental

  await service.updateProperty(id, {
    name: body.name,
    propertyType: body.property_type,
    address: body.address,
    areaSqm: body.area_sqm,
    rentType: body.rent_type,
    monthlyRentCents: body.monthly_rent_cents,
    yearlyRentCents: body.yearly_rent_cents,
    currency: body.currency,
    paymentPeriodMonths: body.payment_period_months,
    landlordName: body.landlord_name,
    landlordContact: body.landlord_contact,
    leaseStartDate: body.lease_start_date,
    leaseEndDate: body.lease_end_date,
    depositCents: body.deposit_cents,
    paymentMethod: body.payment_method,
    paymentAccountId: body.payment_account_id,
    paymentDay: body.payment_day,
    departmentId: body.department_id,
    status: body.status,
    memo: body.memo,
    contractFileUrl: body.contract_file_url,
    createdBy: userId
  })

  logAuditAction(c, 'update', 'rental_property', id, JSON.stringify(body))
  return c.json({ ok: true })
})

const deletePropertyRoute = createRoute({
  method: 'delete',
  path: '/rental-properties/{id}',
  summary: '删除租赁房屋',
  request: {
    params: z.object({ id: uuidSchema })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: '删除成功'
    }
  }
})

rentalRoutes.openapi(deletePropertyRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').rental

  const property = await service.deleteProperty(id)

  logAuditAction(c, 'delete', 'rental_property', id, JSON.stringify({ property_code: property.propertyCode, name: property.name }))
  return c.json({ ok: true })
})

// --- Rental Payments ---

const listPaymentsRoute = createRoute({
  method: 'get',
  path: '/rental-payments',
  summary: '获取租赁付款记录列表',
  request: {
    query: z.object({
      property_id: uuidSchema.optional(),
      year: z.coerce.number().int().optional(),
      month: z.coerce.number().int().optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.object({
              payment: z.any(),
              propertyCode: z.string().nullable(),
              propertyName: z.string().nullable(),
              propertyType: z.string().nullable(),
              accountName: z.string().nullable(),
              categoryName: z.string().nullable(),
              createdByName: z.string().nullable()
            }))
          })
        }
      },
      description: '付款记录列表'
    }
  }
})

rentalRoutes.openapi(listPaymentsRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = c.req.valid('query')
  const service = c.get('services').rental
  const results = await service.listPayments({
    propertyId: query.property_id,
    year: query.year,
    month: query.month
  })
  return c.json({ results })
})

const createPaymentRoute = createRoute({
  method: 'post',
  path: '/rental-payments',
  summary: '创建租赁付款记录',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createRentalPaymentSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), flow_id: z.string(), voucher_no: z.string() })
        }
      },
      description: '创建成功'
    }
  }
})

rentalRoutes.openapi(createPaymentRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'create')) throw Errors.FORBIDDEN()
  const body = c.req.valid('json')
  const userId = c.get('userId')
  const service = c.get('services').rental

  const result = await service.createPayment({
    propertyId: body.property_id,
    paymentDate: body.payment_date,
    year: body.year,
    month: body.month,
    amountCents: body.amount_cents,
    currency: body.currency,
    accountId: body.account_id,
    categoryId: body.category_id,
    paymentMethod: body.payment_method,
    voucherUrl: body.voucher_url,
    memo: body.memo,
    createdBy: userId
  })

  logAuditAction(c, 'create', 'rental_payment', result.id, JSON.stringify({
    property_id: body.property_id,
    year: body.year,
    month: body.month,
    amount_cents: body.amount_cents,
    flow_id: result.flowId
  }))

  return c.json({ id: result.id, flow_id: result.flowId, voucher_no: result.voucherNo })
})

const updatePaymentRoute = createRoute({
  method: 'put',
  path: '/rental-payments/{id}',
  summary: '更新租赁付款记录',
  request: {
    params: z.object({ id: uuidSchema }),
    body: {
      content: {
        'application/json': {
          schema: updateRentalPaymentSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: '更新成功'
    }
  }
})

rentalRoutes.openapi(updatePaymentRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const service = c.get('services').rental

  await service.updatePayment(id, {
    paymentDate: body.payment_date,
    amountCents: body.amount_cents,
    voucherUrl: body.voucher_url,
    memo: body.memo
  })

  logAuditAction(c, 'update', 'rental_payment', id, JSON.stringify(body))
  return c.json({ ok: true })
})

const deletePaymentRoute = createRoute({
  method: 'delete',
  path: '/rental-payments/{id}',
  summary: '删除租赁付款记录',
  request: {
    params: z.object({ id: uuidSchema })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: '删除成功'
    }
  }
})

rentalRoutes.openapi(deletePaymentRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'delete')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').rental

  const payment = await service.deletePayment(id)

  logAuditAction(c, 'delete', 'rental_payment', id, JSON.stringify({
    property_id: payment.propertyId,
    year: payment.year,
    month: payment.month
  }))
  return c.json({ ok: true })
})



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
            generated: z.number(),
            bills: z.array(z.any())
          })
        }
      },
      description: '生成成功'
    }
  }
})

rentalRoutes.openapi(generatePayableBillsRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'create')) throw Errors.FORBIDDEN()
  const userId = c.get('userId')
  const service = c.get('services').rental

  const result = await service.generatePayableBills(userId)

  logAuditAction(c, 'generate', 'rental_payable_bills', '', JSON.stringify({
    count: result.generated,
    generated: result.bills.map((g: any) => g.propertyCode)
  }))

  return c.json(result)
})

const listPayableBillsRoute = createRoute({
  method: 'get',
  path: '/rental-payable-bills',
  summary: '获取应付账单列表',
  request: {
    query: rentalPayableBillQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            results: z.array(z.object({
              bill: z.any(),
              propertyCode: z.string().nullable(),
              propertyName: z.string().nullable(),
              propertyType: z.string().nullable(),
              landlordName: z.string().nullable()
            }))
          })
        }
      },
      description: '应付账单列表'
    }
  }
})

rentalRoutes.openapi(listPayableBillsRoute, async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = c.req.valid('query')
  const service = c.get('services').rental

  const results = await service.listPayableBills({
    propertyId: query.property_id,
    status: query.status,
    startDate: query.start_date,
    endDate: query.end_date
  })

  return c.json({ results })
})

const markBillPaidRoute = createRoute({
  method: 'post',
  path: '/rental-payable-bills/:id/mark-paid',
  summary: 'Mark bill as paid',
  request: {
    params: z.object({ id: uuidSchema })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ ok: z.boolean() })
        }
      },
      description: 'Marked as paid'
    }
  }
})

rentalRoutes.openapi(markBillPaidRoute, async (c) => {
  if (!hasPermission(c, 'asset', 'rental', 'update')) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const service = c.get('services').rental
  const result = await service.markBillPaid(id)
  logAuditAction(c, 'update', 'rental_payable_bill', id, JSON.stringify({ status: 'paid' }))
  return c.json(result, 200)
})
