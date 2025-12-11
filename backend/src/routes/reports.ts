import type { Context } from 'hono'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getAnnualLeaveStats } from '../services/AnnualLeaveService.js'
import {
  dateRangeQuerySchema,
  singleDateQuerySchema,
  arApDetailQuerySchema,
  salaryReportQuerySchema,
  borrowingQuerySchema,
  idParamSchema,
  employeeLeaveQuerySchema
} from '../schemas/common.schema.js'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, isTeamMember, getUserPosition } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'

const app = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

function validateScope(c: Context<{ Bindings: Env, Variables: AppVariables }>, requestedDepartmentId?: string): string | undefined {
  const position = getUserPosition(c)
  const employee = c.get('userEmployee')

  if (!position) return '00000000-0000-0000-0000-000000000000'

  // 1级：总部 - 无限制
  if (position.level === 1) return requestedDepartmentId

  // 2级及以上：项目/团队 - 必须限制在本部门
  const userDepartmentId = employee?.departmentId
  if (!userDepartmentId) {
    // 如果用户无部门，无法查看特定部门数据
    // returns 'NONE' to ensure no match, or undefined if strict mode? 
    // Sending undefined to service usually means "all". We must NOT send undefined if restricted.
    return '00000000-0000-0000-0000-000000000000'
  }

  if (requestedDepartmentId && requestedDepartmentId !== userDepartmentId) {
    throw Errors.FORBIDDEN('Cannot access data from other departments')
  }

  return userDepartmentId
}

// 仪表盘统计
app.openapi(
  createRoute({
    method: 'get',
    path: '/dashboard/stats',
    tags: ['Reports'],
    summary: 'Get dashboard statistics',
    request: {
      query: z.object({
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Dashboard statistics',
        content: {
          'application/json': {
            schema: z.object({
              today: z.object({
                incomeCents: z.number(),
                expenseCents: z.number(),
                count: z.number()
              }),
              month: z.object({
                incomeCents: z.number(),
                expenseCents: z.number(),
                count: z.number()
              }),
              accounts: z.object({
                total: z.number()
              }),
              arAp: z.record(z.object({
                count: z.number(),
                totalCents: z.number(),
                openCents: z.number()
              })),
              borrowings: z.object({
                borrowerCount: z.number(),
                totalBorrowedCents: z.number(),
                totalRepaidCents: z.number(),
                balanceCents: z.number()
              }),
              recentFlows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view') && !getUserPosition(c)) throw Errors.FORBIDDEN()
    const { departmentId } = c.req.valid('query')
    const startId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const stats = await reportService.getDashboardStats(startId)
    return c.json(stats as any)
  }
)

// 项目现金流
app.openapi(
  createRoute({
    method: 'get',
    path: '/department-cash',
    tags: ['Reports'],
    summary: 'Get department cash flow',
    request: {
      query: dateRangeQuerySchema.extend({
        departmentIds: z.string().optional() // Comma separated
      })
    },
    responses: {
      200: {
        description: 'Department cash flow',
        content: {
          'application/json': {
            schema: z.array(z.any())
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, departmentIds } = c.req.valid('query')

    // 验证分割后的 ID
    const rawIds = departmentIds ? departmentIds.split(',') : []
    const position = getUserPosition(c)
    let finalIds: string[] | undefined = rawIds

    if (position && position.level >= 2) {
      const userDeptId = c.get('userEmployee')?.departmentId
      if (!userDeptId) {
        finalIds = ['00000000-0000-0000-0000-000000000000']
      } else {
        // 如果提供了有效 ID，进行检查。如果为空，强制设为用户部门。
        if (finalIds.length > 0) {
          for (const id of finalIds) {
            if (id !== userDeptId) throw Errors.FORBIDDEN('Cannot access other departments')
          }
        } else {
          finalIds = [userDeptId]
        }
      }
    }

    const reportService = c.get('services').report
    const data = await reportService.getDepartmentCashFlow(start, end, finalIds && finalIds.length > 0 ? finalIds : undefined)
    return c.json(data)
  }
)

// 站点增长
app.openapi(
  createRoute({
    method: 'get',
    path: '/site-growth',
    tags: ['Reports'],
    summary: 'Get site growth report',
    request: {
      query: dateRangeQuerySchema.extend({
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Site growth report',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any()),
              prevRange: z.object({
                start: z.string(),
                end: z.string()
              })
            })
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getSiteGrowth(start, end, validId)
    return c.json(data)
  }
)

// AR/AP 汇总
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-ap/summary',
    tags: ['Reports'],
    summary: 'Get AR/AP summary',
    request: {
      query: dateRangeQuerySchema.extend({
        kind: z.enum(['AR', 'AP']),
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'AR/AP summary',
        content: {
          'application/json': {
            schema: z.object({
              totalCents: z.number(),
              settledCents: z.number(),
              byStatus: z.record(z.number()),
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { kind, start, end, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getArApSummary(kind, start, end, validId)
    return c.json(data)
  }
)

// AR/AP 明细
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-ap/detail',
    tags: ['Reports'],
    summary: 'Get AR/AP detail',
    request: {
      query: dateRangeQuerySchema.extend({
        kind: z.enum(['AR', 'AP']),
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'AR/AP detail',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { kind, start, end, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getArApDetail(kind, start, end, validId)
    return c.json(data as any)
  }
)

// 费用汇总
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense/summary',
    tags: ['Reports'],
    summary: 'Get expense summary',
    request: {
      query: dateRangeQuerySchema.extend({
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Expense summary',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getExpenseSummary(start, end, validId)
    return c.json(data as any)
  }
)

// 费用明细
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense/detail',
    tags: ['Reports'],
    summary: 'Get expense detail',
    request: {
      query: dateRangeQuerySchema.extend({
        category_id: z.string().optional(),
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Expense detail',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, category_id, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getExpenseDetail(start, end, category_id, validId)
    return c.json(data as any)
  }
)

// 账户余额
app.openapi(
  createRoute({
    method: 'get',
    path: '/account/balance',
    tags: ['Reports'],
    summary: 'Get account balance',
    request: {
      query: singleDateQuerySchema
    },
    responses: {
      200: {
        description: 'Account balance',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any()),
              asOf: z.string()
            })
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { asOf } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getAccountBalance(asOf)
    return c.json(data)
  }
)

// 借款汇总
app.openapi(
  createRoute({
    method: 'get',
    path: '/borrowing/summary',
    tags: ['Reports'],
    summary: 'Get borrowing summary',
    request: {
      query: borrowingQuerySchema.extend({
        start: z.string().optional(),
        end: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Borrowing summary',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, userId } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getBorrowingSummary(start, end, userId)
    return c.json(data as any)
  }
)

// Borrowing Detail
app.openapi(
  createRoute({
    method: 'get',
    path: '/borrowing/detail/{id}',
    tags: ['Reports'],
    summary: 'Get borrowing detail for user',
    request: {
      params: idParamSchema,
      query: z.object({
        start: z.string().optional(),
        end: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Borrowing detail',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const { start, end } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getBorrowingDetail(id, start, end)
    return c.json(data as any)
  }
)

// New Site Revenue
app.openapi(
  createRoute({
    method: 'get',
    path: '/new-site-revenue',
    tags: ['Reports'],
    summary: 'Get new site revenue',
    request: {
      query: dateRangeQuerySchema.extend({
        days: z.coerce.number().optional(),
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'New site revenue',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'finance', 'view')) throw Errors.FORBIDDEN()
    const { start, end, days, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    const data = await reportService.getNewSiteRevenue(start, end, days, validId)
    return c.json(data as any)
  }
)

// 员工薪资报表
app.openapi(
  createRoute({
    method: 'get',
    path: '/employee-salary',
    tags: ['Reports'],
    summary: 'Get employee salary report',
    request: {
      query: salaryReportQuerySchema.extend({
        departmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Employee salary report',
        content: {
          'application/json': {
            schema: z.object({
              results: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'salary', 'view')) throw Errors.FORBIDDEN()
    const { year, month, departmentId } = c.req.valid('query')
    const validId = validateScope(c, departmentId)
    const reportService = c.get('services').report
    // 未提供年份则默认为当年
    const y = year || new Date().getFullYear()
    const data = await reportService.getEmployeeSalaryReport(y, month, validId)
    return c.json(data)
  }
)

// 年假报表
app.openapi(
  createRoute({
    method: 'get',
    path: '/annual-leave',
    tags: ['Reports'],
    summary: 'Get annual leave report',
    request: {
      query: z.object({
        departmentId: z.string().optional(),
        orgDepartmentId: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Annual leave report',
        content: {
          'application/json': {
            schema: z.any()
          }
        }
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'report', 'hr', 'view')) throw Errors.FORBIDDEN()
    const { departmentId, orgDepartmentId } = c.req.valid('query')

    // 对于年假，支持双层级过滤
    let validDeptId = validateScope(c, departmentId)
    let validOrgDeptId = orgDepartmentId

    const position = getUserPosition(c)
    const employee = c.get('userEmployee')

    if (position && position.level === 3) {
      // 组长：强制使用 orgDepartmentId
      if (employee?.orgDepartmentId) {
        if (validOrgDeptId && validOrgDeptId !== employee.orgDepartmentId) {
          throw Errors.FORBIDDEN('Cannot access other groups')
        }
        validOrgDeptId = employee.orgDepartmentId
      } else {
        validOrgDeptId = 'NONE'
      }
    }

    const reportService = c.get('services').report
    const results = await reportService.getAnnualLeaveReport(validDeptId, validOrgDeptId)
    return c.json(results as any)
  }
)

export default app
