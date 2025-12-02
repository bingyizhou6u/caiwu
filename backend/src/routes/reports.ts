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
import { hasPermission, isTeamMember } from '../utils/permissions.js'

const app = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Dashboard Stats
app.openapi(
  createRoute({
    method: 'get',
    path: '/dashboard/stats',
    tags: ['Reports'],
    summary: 'Get dashboard statistics',
    request: {
      query: z.object({
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Dashboard statistics',
        content: {
          'application/json': {
            schema: z.object({
              today: z.object({
                income_cents: z.number(),
                expense_cents: z.number(),
                count: z.number()
              }),
              month: z.object({
                income_cents: z.number(),
                expense_cents: z.number(),
                count: z.number()
              }),
              accounts: z.object({
                total: z.number()
              }),
              ar_ap: z.record(z.object({
                count: z.number(),
                total_cents: z.number(),
                open_cents: z.number()
              })),
              borrowings: z.object({
                borrower_count: z.number(),
                total_borrowed_cents: z.number(),
                total_repaid_cents: z.number(),
                balance_cents: z.number()
              }),
              recent_flows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const stats = await reportService.getDashboardStats(department_id)
    return c.json(stats as any)
  }
)

// Department Cash Flow
app.openapi(
  createRoute({
    method: 'get',
    path: '/department-cash',
    tags: ['Reports'],
    summary: 'Get department cash flow',
    request: {
      query: dateRangeQuerySchema.extend({
        department_ids: z.string().optional() // Comma separated
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
    const { start, end, department_ids } = c.req.valid('query')
    const deptIds = department_ids ? department_ids.split(',') : undefined
    const reportService = c.get('services').report
    const data = await reportService.getDepartmentCashFlow(start, end, deptIds)
    return c.json(data)
  }
)

// Site Growth
app.openapi(
  createRoute({
    method: 'get',
    path: '/site-growth',
    tags: ['Reports'],
    summary: 'Get site growth report',
    request: {
      query: dateRangeQuerySchema.extend({
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Site growth report',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any()),
              prev_range: z.object({
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
    const { start, end, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getSiteGrowth(start, end, department_id)
    return c.json(data)
  }
)

// AR/AP Summary
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-ap/summary',
    tags: ['Reports'],
    summary: 'Get AR/AP summary',
    request: {
      query: dateRangeQuerySchema.extend({
        kind: z.enum(['AR', 'AP']),
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'AR/AP summary',
        content: {
          'application/json': {
            schema: z.object({
              total_cents: z.number(),
              settled_cents: z.number(),
              by_status: z.record(z.number()),
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { kind, start, end, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getArApSummary(kind, start, end, department_id)
    return c.json(data)
  }
)

// AR/AP Detail
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-ap/detail',
    tags: ['Reports'],
    summary: 'Get AR/AP detail',
    request: {
      query: dateRangeQuerySchema.extend({
        kind: z.enum(['AR', 'AP']),
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'AR/AP detail',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { kind, start, end, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getArApDetail(kind, start, end, department_id)
    return c.json(data)
  }
)

// Expense Summary
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense/summary',
    tags: ['Reports'],
    summary: 'Get expense summary',
    request: {
      query: dateRangeQuerySchema.extend({
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Expense summary',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { start, end, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getExpenseSummary(start, end, department_id)
    return c.json(data)
  }
)

// Expense Detail
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense/detail',
    tags: ['Reports'],
    summary: 'Get expense detail',
    request: {
      query: dateRangeQuerySchema.extend({
        category_id: z.string().optional(),
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Expense detail',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { start, end, category_id, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getExpenseDetail(start, end, category_id, department_id)
    return c.json(data)
  }
)

// Account Balance
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
              as_of: z.string()
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { as_of } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getAccountBalance(as_of)
    return c.json(data)
  }
)

// Borrowing Summary
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
            schema: z.object({
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { start, end, user_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getBorrowingSummary(start, end, user_id)
    return c.json(data)
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
            schema: z.object({
              borrowings: z.array(z.any()),
              repayments: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const { start, end } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getBorrowingDetail(id, start, end)
    return c.json(data)
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
        department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'New site revenue',
        content: {
          'application/json': {
            schema: z.object({
              rows: z.array(z.any())
            })
          }
        }
      }
    }
  }),
  async (c) => {
    const { start, end, days, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    const data = await reportService.getNewSiteRevenue(start, end, days, department_id)
    return c.json(data)
  }
)

// Employee Salary Report
app.openapi(
  createRoute({
    method: 'get',
    path: '/employee-salary',
    tags: ['Reports'],
    summary: 'Get employee salary report',
    request: {
      query: salaryReportQuerySchema.extend({
        department_id: z.string().optional()
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
    const { year, month, department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    // Default to current year if not provided
    const y = year || new Date().getFullYear()
    const data = await reportService.getEmployeeSalaryReport(y, month, department_id)
    return c.json(data)
  }
)

// Annual Leave Report
app.openapi(
  createRoute({
    method: 'get',
    path: '/annual-leave',
    tags: ['Reports'],
    summary: 'Get annual leave report',
    request: {
      query: z.object({
        department_id: z.string().optional(),
        org_department_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Annual leave report',
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
    const { department_id, org_department_id } = c.req.valid('query')
    const reportService = c.get('services').report
    // Pass c.env.DB (raw D1) to getAnnualLeaveReport
    const results = await reportService.getAnnualLeaveReport(c.env.DB, department_id, org_department_id)
    return c.json(results as any)
  }
)

export default app
