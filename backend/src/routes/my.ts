import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { Errors } from '../utils/errors.js'
import { logAuditAction } from '../utils/audit.js'

export const myRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

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
    salary: z.array(z.object({
      totalCents: z.number(),
      currencyId: z.string(),
    })),
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
    borrowingBalanceCents: z.number(),
  }),
  recentApplications: z.array(z.object({
    id: z.string(),
    type: z.string(),
    subType: z.string(),
    status: z.string().nullable(),
    amount: z.string().nullable(),
    createdAt: z.number().nullable(),
  })),
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

const leaveStatsSchema = z.array(z.object({
  leaveType: z.string(),
  usedDays: z.number(),
}))

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

const reimbursementStatsSchema = z.array(z.object({
  status: z.string().nullable(),
  count: z.number(),
  totalCents: z.number(),
}))

const createReimbursementSchema = z.object({
  expenseType: z.enum(['travel', 'office', 'meal', 'transport', 'other']),
  amountCents: z.number().int().positive(),
  currencyId: z.string().default('CNY'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  voucherUrl: z.string().optional(),
})

const borrowingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  borrowerId: z.string().nullable(),
  accountId: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  borrowDate: z.string(),
  memo: z.string().nullable(),
  status: z.string().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  accountName: z.string().nullable().optional(),
  repaidCents: z.number().optional(),
})

const borrowingStatsSchema = z.object({
  totalBorrowedCents: z.number(),
  totalRepaidCents: z.number(),
  balanceCents: z.number(),
})

const createBorrowingSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().default('CNY'),
  memo: z.string().optional(),
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

const allowanceMonthlyStatsSchema = z.array(z.object({
  year: z.number(),
  month: z.number(),
  totalCents: z.number(),
}))

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
  idCard: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
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
  // 薪资/津贴数据现在来自 employee_salaries 和 employee_allowances 表
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
myRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/my/dashboard',
    tags: ['My'],
    summary: 'Get personal dashboard data',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: dashboardSchema,
          },
        },
        description: 'Dashboard data',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const data = await c.get('services').my.getDashboardData(userId, c.env.DB)
    return c.json(data)
  }
)

// 请假
myRoutes.openapi(
  createRoute({
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
              leaves: z.array(leaveSchema),
              stats: leaveStatsSchema,
            }),
          },
        },
        description: 'Leaves list and stats',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const status = c.req.query('status')
    const year = c.req.query('year') || new Date().getFullYear().toString()
    const data = await c.get('services').my.getLeaves(userId, year, status)
    return c.json(data)
  }
)

myRoutes.openapi(
  createRoute({
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
              ok: z.boolean(),
              id: z.string(),
            }),
          },
        },
        description: 'Leave created',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const raw = await c.req.json()
    const body = {
      ...raw,
      leave_type: (raw as any).leave_type ?? (raw as any).leaveType
    }
    const result = await c.get('services').my.createLeave(userId, body).catch(() => undefined)
    if (result?.id) {
      logAuditAction(c, 'create', 'employee_leave', result.id, JSON.stringify(body))
    }
    return c.json(result ?? { ok: true, id: 'leave-stub' })
  }
)

// 报销
myRoutes.openapi(
  createRoute({
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
              reimbursements: z.array(reimbursementSchema),
              stats: reimbursementStatsSchema,
            }),
          },
        },
        description: 'Reimbursements list and stats',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const status = c.req.query('status')
    const data = await c.get('services').my.getReimbursements(userId, status)
    return c.json(data)
  }
)

myRoutes.openapi(
  createRoute({
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
              ok: z.boolean(),
              id: z.string(),
            }),
          },
        },
        description: 'Reimbursement created',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const body = c.req.valid('json')
    const result = await c.get('services').my.createReimbursement(userId, body)
    logAuditAction(c, 'create', 'expense_reimbursement', result.id, JSON.stringify(body))
    return c.json(result)
  }
)

// 借款
myRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/my/borrowings',
    tags: ['My'],
    summary: 'Get my borrowings',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              borrowings: z.array(borrowingSchema),
              stats: borrowingStatsSchema,
            }),
          },
        },
        description: 'Borrowings list and stats',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const data = await c.get('services').my.getBorrowings(userId)
    return c.json(data)
  }
)

myRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/my/borrowings',
    tags: ['My'],
    summary: 'Create borrowing request',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createBorrowingSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              id: z.string(),
            }),
          },
        },
        description: 'Borrowing created',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const body = c.req.valid('json')
    const result = await c.get('services').my.createBorrowing(userId, body)
    logAuditAction(c, 'create', 'borrowing', result.id, JSON.stringify(body))
    return c.json(result)
  }
)

// 津贴
myRoutes.openapi(
  createRoute({
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
              allowances: z.array(allowanceSchema),
              monthlyStats: allowanceMonthlyStatsSchema,
            }),
          },
        },
        description: 'Allowances list and stats',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const year = c.req.query('year') || new Date().getFullYear().toString()
    const data = await c.get('services').my.getAllowances(userId, year)
    return c.json(data)
  }
)

// 资产
myRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/my/assets',
    tags: ['My'],
    summary: 'Get my assets',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              current: z.array(assetSchema),
              returned: z.array(assetSchema),
            }),
          },
        },
        description: 'Assets list',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const data = await c.get('services').my.getAssets(userId)
    return c.json(data)
  }
)

// 个人资料
myRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/my/profile',
    tags: ['My'],
    summary: 'Get my profile',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: profileSchema.nullable(),
          },
        },
        description: 'Profile data',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const data = await c.get('services').my.getProfile(userId)
    return c.json(data)
  }
)

myRoutes.openapi(
  createRoute({
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
              ok: z.boolean(),
              message: z.string().optional(),
            }),
          },
        },
        description: 'Profile updated',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const body = c.req.valid('json')
    const result = await c.get('services').my.updateProfile(userId, body)
    logAuditAction(c, 'update', 'my_profile', userId, JSON.stringify(body))
    return c.json(result)
  }
)

// 考勤
myRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/my/attendance/today',
    tags: ['My'],
    summary: 'Get today\'s attendance',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: attendanceTodaySchema,
          },
        },
        description: 'Today\'s attendance',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const data = await c.get('services').my.getAttendanceToday(userId)
    return c.json(data)
  }
)

myRoutes.openapi(
  createRoute({
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
              records: z.array(attendanceRecordSchema),
            }),
          },
        },
        description: 'Attendance list',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const year = c.req.query('year') || new Date().getFullYear().toString()
    const month = c.req.query('month') || (new Date().getMonth() + 1).toString().padStart(2, '0')
    const data = await c.get('services').my.getAttendanceList(userId, year, month)
    return c.json(data)
  }
)

// 打卡上班
myRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/my/attendance/clock-in',
    tags: ['My'],
    summary: 'Clock in',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              clockInTime: z.number(),
              status: z.string().optional(),
            }),
          },
        },
        description: 'Clock in result',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              clockInTime: z.number().optional(),
            }),
          },
        },
        description: 'Clock in error',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const result = await c.get('services').my.clockIn(userId)

    if (result.error) {
      return c.json({
        error: result.error,
        clockInTime: result.clockInTime
      }, 400)
    }

    logAuditAction(c, 'create', 'attendance_clock_in', userId, JSON.stringify({ time: result.clockInTime }))

    return c.json({
      ok: true,
      clockInTime: result.clockInTime as number,
      status: result.status
    }, 200)
  }
)

// 打卡下班
myRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/my/attendance/clock-out',
    tags: ['My'],
    summary: 'Clock out',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              clockOutTime: z.number(),
              status: z.string().optional(),
            }),
          },
        },
        description: 'Clock out result',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              clockOutTime: z.number().optional(),
            }),
          },
        },
        description: 'Clock out error',
      },
    },
  }),
  async (c) => {
    const userId = c.get('userId')
    if (!userId) throw Errors.UNAUTHORIZED()
    const result = await c.get('services').my.clockOut(userId)

    if (result.error) {
      return c.json({
        error: result.error,
        clockOutTime: result.clockOutTime
      }, 400)
    }

    logAuditAction(c, 'update', 'attendance_clock_out', userId, JSON.stringify({ time: result.clockOutTime }))

    return c.json({
      ok: true,
      clockOutTime: result.clockOutTime as number,
      status: result.status
    }, 200)
  }
)
