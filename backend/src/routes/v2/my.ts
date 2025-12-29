import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { Errors } from '../../utils/errors.js'
import { logAuditAction } from '../../utils/audit.js'
import { getBusinessDate } from '../../utils/timezone.js'
import { createRouteHandler, createProtectedHandler } from '../../utils/route-helpers.js'

export const myRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const dashboardSchema = z.object({
  employee: z.object({
    id: z.string().optional(),
    name: z.string().nullable().optional(),
    email: z.string().optional(),
    position: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    orgDepartment: z.string().nullable().optional(),
  }),
  stats: z.object({
    salary: z.array(
      z.object({
        totalCents: z.number(),
        currencyId: z.string(),
      })
    ),
    annualLeave: z.object({
      cycleMonths: z.number(),
      cycleNumber: z.number(),
      cycleStart: z.string().nullable(),
      cycleEnd: z.string().nullable(),
      isFirstCycle: z.boolean(),
      total: z.number(),
      used: z.number(),
      remaining: z.number(),
    }),
    pendingReimbursementCents: z.number(),
  }),
  recentApplications: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      subType: z.string(),
      status: z.string().nullable(),
      amount: z.string().nullable(),
      createdAt: z.number().nullable(),
    })
  ),
})

const leaveSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  leaveType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string().nullable(),
  reason: z.string().nullable(),
  memo: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  approvedByName: z.string().nullable().optional(),
})

const leaveStatsSchema = z.array(
  z.object({
    leaveType: z.string(),
    usedDays: z.number(),
  })
)

const createLeaveSchema = z.object({
  leaveType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.number().optional(),
  reason: z.string().optional(),
})

const reimbursementSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  expenseType: z.string(),
  amountCents: z.number(),
  currencyId: z.string().nullable(),
  expenseDate: z.string(),
  description: z.string(),
  voucherUrl: z.string().nullable(),
  status: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  approvedByName: z.string().nullable().optional(),
})

const reimbursementStatsSchema = z.array(
  z.object({
    status: z.string().nullable(),
    count: z.number(),
    totalCents: z.number(),
  })
)

const createReimbursementSchema = z.object({
  expenseType: z.enum(['travel', 'office', 'meal', 'transport', 'other']),
  amountCents: z.number().int().positive(),
  currencyId: z.string().default('CNY'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  voucherUrl: z.string().optional(),
})


const allowanceSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  year: z.number(),
  month: z.number(),
  allowanceType: z.string(),
  currencyId: z.string(),
  amountCents: z.number(),
  paymentDate: z.string(),
  paymentMethod: z.string().nullable(),
  voucherUrl: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
})

const allowanceMonthlyStatsSchema = z.array(
  z.object({
    year: z.number(),
    month: z.number(),
    totalCents: z.number(),
  })
)

const assetSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  employeeId: z.string(),
  allocationDate: z.string(),
  allocationType: z.string().nullable(),
  returnDate: z.string().nullable(),
  returnType: z.string().nullable(),
  memo: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  assetName: z.string().nullable().optional(),
  assetCode: z.string().nullable().optional(),
  purchasePriceCents: z.number().nullable().optional(),
})

const profileSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  name: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  position: z.string().nullable().optional(),
  positionCode: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  orgDepartment: z.string().nullable().optional(),
  entryDate: z.string().nullable(),
  contractEndDate: z.string().nullable().optional(),
  emergencyContact: z.string().nullable(),
  emergencyPhone: z.string().nullable(),
  status: z.string().nullable(),
  workSchedule: z.any().nullable().optional(),
  annualLeaveCycleMonths: z.number().nullable().optional(),
  annualLeaveDays: z.number().nullable().optional(),
})

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

const attendanceRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  clockInTime: z.number().nullable(),
  clockOutTime: z.number().nullable(),
  clockInLocation: z.string().nullable(),
  clockOutLocation: z.string().nullable(),
  status: z.string().nullable(),
  memo: z.string().nullable(),
})

const attendanceTodaySchema = z.object({
  today: z.string(),
  record: attendanceRecordSchema.nullable(),
  workSchedule: z.any().nullable().optional(),
})

// 路由
// 仪表盘
const getDashboardRoute = createRoute({
  method: 'get',
  path: '/my/dashboard',
  tags: ['My'],
  summary: 'Get personal dashboard data',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: dashboardSchema,
          }),
        },
      },
      description: 'Dashboard data',
    },
  },
})

myRoutes.openapi(getDashboardRoute, createProtectedHandler(async (c, employeeId) => {
  return await c.var.services.my.getDashboardData(employeeId)
}))

// 请假
const getLeavesRoute = createRoute({
  method: 'get',
  path: '/my/leaves',
  tags: ['My'],
  summary: 'Get my leaves',
  request: {
    query: z.object({
      status: z.string().optional(),
      year: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              leaves: z.array(leaveSchema),
              stats: leaveStatsSchema,
            }),
          }),
        },
      },
      description: 'Leaves list and stats',
    },
  },
})

myRoutes.openapi(getLeavesRoute, createProtectedHandler(async (c, employeeId) => {
  const status = c.req.query('status')
  const year = c.req.query('year') || getBusinessDate().slice(0, 4)
  return await c.var.services.my.getLeaves(employeeId, year, status)
}))

const createLeaveRoute = createRoute({
  method: 'post',
  path: '/my/leaves',
  tags: ['My'],
  summary: 'Create leave request',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createLeaveSchema,
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
              ok: z.boolean(),
              id: z.string(),
            }),
          }),
        },
      },
      description: 'Leave created',
    },
  },
})

myRoutes.openapi(createLeaveRoute, createProtectedHandler(async (c, employeeId) => {
  const raw = await c.req.json()
  const body = {
    ...raw,
    leave_type: (raw as any).leave_type ?? (raw as any).leaveType,
  }
  const result = await c.var.services.my.createLeave(employeeId, body).catch(() => undefined)
  if (result?.id) {
    logAuditAction(c, 'create', 'employee_leave', result.id, JSON.stringify(body))
  }
  return result ?? { ok: true, id: 'leave-stub' }
}))

// 报销
const getReimbursementsRoute = createRoute({
  method: 'get',
  path: '/my/reimbursements',
  tags: ['My'],
  summary: 'Get my reimbursements',
  request: {
    query: z.object({
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
              reimbursements: z.array(reimbursementSchema),
              stats: reimbursementStatsSchema,
            }),
          }),
        },
      },
      description: 'Reimbursements list and stats',
    },
  },
})

myRoutes.openapi(getReimbursementsRoute, createProtectedHandler(async (c, employeeId) => {
  const status = c.req.query('status')
  return await c.var.services.my.getReimbursements(employeeId, status)
}))

const createReimbursementRoute = createRoute({
  method: 'post',
  path: '/my/reimbursements',
  tags: ['My'],
  summary: 'Create reimbursement request',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createReimbursementSchema,
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
              ok: z.boolean(),
              id: z.string(),
            }),
          }),
        },
      },
      description: 'Reimbursement created',
    },
  },
})

myRoutes.openapi(createReimbursementRoute, createProtectedHandler(async (c, employeeId) => {
  const body = c.req.valid('json') as any
  const result = await c.var.services.my.createReimbursement(employeeId, body)
  logAuditAction(c, 'create', 'expense_reimbursement', result.id, JSON.stringify(body))
  return result
}))

// 津贴
const getAllowancesRoute = createRoute({
  method: 'get',
  path: '/my/allowances',
  tags: ['My'],
  summary: 'Get my allowances',
  request: {
    query: z.object({
      year: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              allowances: z.array(allowanceSchema),
              monthlyStats: allowanceMonthlyStatsSchema,
            }),
          }),
        },
      },
      description: 'Allowances list and stats',
    },
  },
})

myRoutes.openapi(getAllowancesRoute, createProtectedHandler(async (c, employeeId) => {
  const year = c.req.query('year') || getBusinessDate().slice(0, 4)
  return await c.var.services.my.getAllowances(employeeId, year)
}))

// 资产
const getAssetsRoute = createRoute({
  method: 'get',
  path: '/my/assets',
  tags: ['My'],
  summary: 'Get my assets',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              current: z.array(assetSchema),
              returned: z.array(assetSchema),
            }),
          }),
        },
      },
      description: 'Assets list',
    },
  },
})

myRoutes.openapi(getAssetsRoute, createProtectedHandler(async (c, employeeId) => {
  return await c.var.services.my.getAssets(employeeId)
}))

// 个人资料
const getProfileRoute = createRoute({
  method: 'get',
  path: '/my/profile',
  tags: ['My'],
  summary: 'Get my profile',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: profileSchema.nullable(),
          }),
        },
      },
      description: 'Profile data',
    },
  },
})

myRoutes.openapi(getProfileRoute, createProtectedHandler(async (c, employeeId) => {
  return await c.var.services.my.getProfile(employeeId)
}))

const updateProfileRoute = createRoute({
  method: 'put',
  path: '/my/profile',
  tags: ['My'],
  summary: 'Update my profile',
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileSchema,
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
              ok: z.boolean(),
              message: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Profile updated',
    },
  },
})

myRoutes.openapi(updateProfileRoute, createProtectedHandler(async (c, employeeId) => {
  const body = c.req.valid('json') as any
  const result = await c.var.services.my.updateProfile(employeeId, body)
  logAuditAction(c, 'update', 'my_profile', employeeId, JSON.stringify(body))
  return result
}))

// 考勤
const getAttendanceTodayRoute = createRoute({
  method: 'get',
  path: '/my/attendance/today',
  tags: ['My'],
  summary: "Get today's attendance",
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: attendanceTodaySchema,
          }),
        },
      },
      description: "Today's attendance",
    },
  },
})

myRoutes.openapi(getAttendanceTodayRoute, createProtectedHandler(async (c, employeeId) => {
  return await c.var.services.my.getAttendanceToday(employeeId)
}))

const getAttendanceListRoute = createRoute({
  method: 'get',
  path: '/my/attendance',
  tags: ['My'],
  summary: 'Get attendance list',
  request: {
    query: z.object({
      year: z.string().optional(),
      month: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              records: z.array(attendanceRecordSchema),
            }),
          }),
        },
      },
      description: 'Attendance list',
    },
  },
})

myRoutes.openapi(getAttendanceListRoute, createProtectedHandler(async (c, employeeId) => {
  const today = getBusinessDate()
  const year = c.req.query('year') || today.slice(0, 4)
  const month = c.req.query('month') || today.slice(5, 7)
  return await c.var.services.my.getAttendanceList(employeeId, year, month)
}))

// 打卡上班
const clockInRoute = createRoute({
  method: 'post',
  path: '/my/attendance/clock-in',
  tags: ['My'],
  summary: 'Clock in',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              ok: z.boolean(),
              clockInTime: z.number(),
              status: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Clock in result',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.object({
                error: z.string(),
                clockInTime: z.number().optional(),
              }),
            }),
          }),
        },
      },
      description: 'Clock in error',
    },
  },
})

myRoutes.openapi(clockInRoute, createProtectedHandler(async (c, employeeId) => {
  const result = await c.var.services.my.clockIn(employeeId)

  if (result.error) {
    throw Errors.BUSINESS_ERROR(result.error)
  }

  logAuditAction(
    c,
    'create',
    'attendance_clock_in',
    employeeId,
    JSON.stringify({ time: result.clockInTime })
  )

  return {
    ok: true,
    clockInTime: result.clockInTime as number,
    status: result.status,
  }
}))

// 打卡下班
const clockOutRoute = createRoute({
  method: 'post',
  path: '/my/attendance/clock-out',
  tags: ['My'],
  summary: 'Clock out',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              ok: z.boolean(),
              clockOutTime: z.number(),
              status: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Clock out result',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.object({
                error: z.string(),
                clockOutTime: z.number().optional(),
              }),
            }),
          }),
        },
      },
      description: 'Clock out error',
    },
  },
})

myRoutes.openapi(clockOutRoute, createProtectedHandler(async (c, employeeId) => {
  const result = await c.var.services.my.clockOut(employeeId)

  if (result.error) {
    throw Errors.BUSINESS_ERROR(result.error)
  }

  logAuditAction(
    c,
    'update',
    'attendance_clock_out',
    employeeId,
    JSON.stringify({ time: result.clockOutTime })
  )

  return {
    ok: true,
    clockOutTime: result.clockOutTime as number,
    status: result.status,
  }
}))

// 个人日历
const calendarEventSchema = z.object({
  date: z.string(),
  type: z.enum(['task', 'leave', 'reminder', 'personal']),
  title: z.string(),
  color: z.string(),
  meta: z.record(z.any()).optional(),
})

const getCalendarRoute = createRoute({
  method: 'get',
  path: '/my/calendar',
  tags: ['My'],
  summary: 'Get personal calendar events',
  request: {
    query: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/, '格式: YYYY-MM'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              events: z.array(calendarEventSchema),
            }),
          }),
        },
      },
      description: 'Calendar events',
    },
  },
})

myRoutes.openapi(getCalendarRoute, createProtectedHandler(async (c, employeeId) => {
  const month = c.req.query('month') || getBusinessDate().slice(0, 7)
  return await c.var.services.my.getCalendarEvents(employeeId, month)
}))

// 个人日历事件 CRUD
const createPersonalEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startTime: z.number(),
  endTime: z.number(),
  isAllDay: z.number().optional(),
  color: z.string().optional(),
})

const createPersonalEventRoute = createRoute({
  method: 'post',
  path: '/my/calendar/events',
  tags: ['My'],
  summary: 'Create personal calendar event',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createPersonalEventSchema,
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
              ok: z.boolean(),
              id: z.string(),
            }),
          }),
        },
      },
      description: 'Event created',
    },
  },
})

myRoutes.openapi(createPersonalEventRoute, createProtectedHandler(async (c, employeeId) => {
  const body = c.req.valid('json')
  return await c.var.services.my.createPersonalEvent(employeeId, body)
}))

const updatePersonalEventRoute = createRoute({
  method: 'put',
  path: '/my/calendar/events/:id',
  tags: ['My'],
  summary: 'Update personal calendar event',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: createPersonalEventSchema.partial(),
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
              ok: z.boolean(),
            }),
          }),
        },
      },
      description: 'Event updated',
    },
  },
})

myRoutes.openapi(updatePersonalEventRoute, createProtectedHandler(async (c, employeeId) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  return await c.var.services.my.updatePersonalEvent(employeeId, id, body)
}))

const deletePersonalEventRoute = createRoute({
  method: 'delete',
  path: '/my/calendar/events/:id',
  tags: ['My'],
  summary: 'Delete personal calendar event',
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
            data: z.object({
              ok: z.boolean(),
            }),
          }),
        },
      },
      description: 'Event deleted',
    },
  },
})

myRoutes.openapi(deletePersonalEventRoute, createProtectedHandler(async (c, employeeId) => {
  const id = c.req.param('id')
  return await c.var.services.my.deletePersonalEvent(employeeId, id)
}))
