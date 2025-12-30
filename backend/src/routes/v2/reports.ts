import type { Context } from 'hono'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

import {
  dateRangeQuerySchema,
  singleDateQuerySchema,
  salaryReportQuerySchema,
  idParamSchema,
} from '../../schemas/common.schema.js'
import type { Env, AppVariables } from '../../types/index.js'
import { createPermissionContext } from '../../utils/permission-context.js'
import { PermissionModule, PermissionAction, DataScope } from '../../constants/permissions.js'
import { Errors } from '../../utils/errors.js'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'
import { exportToCSV, createCSVResponse, formatAmountCents, formatDate } from '../../utils/export.js'
import { getBusinessDate } from '../../utils/timezone.js'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

function validateScope(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  requestedProjectId?: string
): string | undefined {
  const permCtx = createPermissionContext(c)
  const employee = c.get('userEmployee')

  if (!permCtx) {
    return '00000000-0000-0000-0000-000000000000'
  }

  // 总部 - 无限制
  if (permCtx.dataScope === DataScope.ALL) {
    return requestedProjectId
  }

  // 其他 - 必须限制在本部门
  const userProjectId = employee?.projectId
  if (!userProjectId) {
    return '00000000-0000-0000-0000-000000000000'
  }

  if (requestedProjectId && requestedProjectId !== userProjectId) {
    throw Errors.FORBIDDEN('Cannot access data from other departments')
  }

  return userProjectId
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
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Dashboard statistics',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                today: z.object({
                  incomeCents: z.number(),
                  expenseCents: z.number(),
                  count: z.number(),
                }),
                month: z.object({
                  incomeCents: z.number(),
                  expenseCents: z.number(),
                  count: z.number(),
                }),
                accounts: z.object({
                  total: z.number(),
                }),
                arAp: z.record(
                  z.object({
                    count: z.number(),
                    totalCents: z.number(),
                    openCents: z.number(),
                  })
                ),
                recentFlows: z.array(z.any()),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { projectId } = c.req.valid('query')
    const startId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const stats = await reportService.getDashboardStats(startId)
    return stats
  }) as any
)

// 项目现金流
app.openapi(
  createRoute({
    method: 'get',
    path: '/department-cash',
    tags: ['Reports'],
    summary: 'Get department cash flow',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectIds: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Department cash flow',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectIds } = c.req.valid('query')

    // 使用统一的 validateScope 函数验证权限
    const rawIds = projectIds ? projectIds.split(',') : []
    const validatedIds: string[] = []

    if (rawIds.length > 0) {
      // 验证每个 projectId
      for (const id of rawIds) {
        try {
          const validatedId = validateScope(c, id)
          if (validatedId && validatedId !== '00000000-0000-0000-0000-000000000000') {
            validatedIds.push(validatedId)
          }
        } catch (error) {
          // validateScope 会在权限不足时抛出错误，直接传播
          throw error
        }
      }
    } else {
      // 如果没有提供 projectIds，使用 validateScope 获取用户的 projectId
      const userDeptId = validateScope(c, undefined)
      if (userDeptId && userDeptId !== '00000000-0000-0000-0000-000000000000') {
        validatedIds.push(userDeptId)
      }
    }

    const reportService = c.var.services.report
    const data = await reportService.getDepartmentCashFlow(
      start,
      end,
      validatedIds.length > 0 ? validatedIds : undefined
    )
    return data
  }) as any
)

// 站点增长
app.openapi(
  createRoute({
    method: 'get',
    path: '/site-growth',
    tags: ['Reports'],
    summary: 'Get site growth report',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Site growth report',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                rows: z.array(z.any()),
                prevRange: z.object({
                  start: z.string(),
                  end: z.string(),
                }),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getSiteGrowth(start, end, validId)
    return data
  }) as any
)

// AR/AP 汇总
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-summary',
    tags: ['Reports'],
    summary: 'Get AR summary',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'AR summary',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                totalCents: z.number(),
                settledCents: z.number(),
                byStatus: z.record(z.number()),
                rows: z.array(z.any()),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getArApSummary('AR', start, end, validId)
    return data
  }) as any
)

app.openapi(
  createRoute({
    method: 'get',
    path: '/ap-summary',
    tags: ['Reports'],
    summary: 'Get AP summary',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'AP summary',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                totalCents: z.number(),
                settledCents: z.number(),
                byStatus: z.record(z.number()),
                rows: z.array(z.any()),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getArApSummary('AP', start, end, validId)
    return data
  }) as any
)

// AR/AP 明细
app.openapi(
  createRoute({
    method: 'get',
    path: '/ar-detail',
    tags: ['Reports'],
    summary: 'Get AR detail',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'AR detail',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getArApDetail('AR', start, end, validId)
    return data
  }) as any
)

app.openapi(
  createRoute({
    method: 'get',
    path: '/ap-detail',
    tags: ['Reports'],
    summary: 'Get AP detail',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'AP detail',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getArApDetail('AP', start, end, validId)
    return data
  }) as any
)

// 费用汇总
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense-summary',
    tags: ['Reports'],
    summary: 'Get expense summary',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Expense summary',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getExpenseSummary(start, end, validId)
    return data
  }) as any
)

// 费用明细
app.openapi(
  createRoute({
    method: 'get',
    path: '/expense-detail',
    tags: ['Reports'],
    summary: 'Get expense detail',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        category_id: z.string().optional(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Expense detail',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, category_id, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getExpenseDetail(start, end, category_id, validId)
    return data
  }) as any
)

// 账户余额
app.openapi(
  createRoute({
    method: 'get',
    path: '/account-balance',
    tags: ['Reports'],
    summary: 'Get account balance',
    request: {
      query: singleDateQuerySchema,
    },
    responses: {
      200: {
        description: 'Account balance',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                rows: z.array(z.any()),
                asOf: z.string(),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { asOf } = c.req.valid('query')
    const reportService = c.var.services.report
    const data = await reportService.getAccountBalance(asOf)
    return data
  }) as any
)

// New Site Revenue
app.openapi(
  createRoute({
    method: 'get',
    path: '/new-site-revenue',
    tags: ['Reports'],
    summary: 'Get new site revenue',
    request: {
      query: z.object({
        start: z.string().date(),
        end: z.string().date(),
        days: z.coerce.number().optional(),
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'New site revenue',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { start, end, days, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const data = await reportService.getNewSiteRevenue(start, end, days, validId)
    return data
  }) as any
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
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Employee salary report',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                results: z.array(z.any()),
              }),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    // 允许有 report.salary.view 权限或 report.finance.view 权限的用户访问
    const permCtx = createPermissionContext(c)
    if (!permCtx || (!permCtx.hasPermission(PermissionModule.REPORT, 'salary', PermissionAction.VIEW) && !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW))) {
      throw Errors.FORBIDDEN()
    }
    const { year, month, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const y = year || getBusinessDate().slice(0, 4)
    const data = await reportService.getEmployeeSalaryReport(y, month, validId)
    return data
  }) as any
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
        projectId: z.string().optional(),
        orgDepartmentId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Annual leave report',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.any(),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || !permCtx.hasPermission(PermissionModule.REPORT, 'hr', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { projectId, orgDepartmentId } = c.req.valid('query')

    const validDeptId = validateScope(c, projectId)
    let validOrgDeptId = orgDepartmentId

    const employee = c.get('userEmployee')

    if (permCtx.dataScope === DataScope.GROUP) {
      if (employee?.orgDepartmentId) {
        if (validOrgDeptId && validOrgDeptId !== employee.orgDepartmentId) {
          throw Errors.FORBIDDEN('Cannot access other groups')
        }
        validOrgDeptId = employee.orgDepartmentId
      } else {
        validOrgDeptId = 'NONE'
      }
    }

    const reportService = c.var.services.report
    const results = await reportService.getAnnualLeaveReport(validDeptId, validOrgDeptId)
    return results
  }) as any
)

// 员工薪资报表导出
app.openapi(
  createRoute({
    method: 'get',
    path: '/employee-salary/export',
    tags: ['Reports'],
    summary: 'Export employee salary report to CSV',
    request: {
      query: salaryReportQuerySchema.extend({
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'CSV file',
        content: {
          'text/csv': {
            schema: z.string(),
          },
        },
      },
    },
  }),
  async c => {
    // 允许有 report.salary.view 权限或 report.finance.view 权限的用户访问
    const permCtx = createPermissionContext(c)
    if (!permCtx || (!permCtx.hasPermission(PermissionModule.REPORT, 'salary', PermissionAction.VIEW) && !permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW))) {
      throw Errors.FORBIDDEN()
    }
    const { year, month, projectId } = c.req.valid('query')
    const validId = validateScope(c, projectId)
    const reportService = c.var.services.report
    const y = year || parseInt(getBusinessDate().slice(0, 4))
    const data = await reportService.getEmployeeSalaryReport(y, month, validId, false) // 不使用缓存

    const csvContent = exportToCSV(
      ((data as any)?.results || []) as Array<Record<string, any>>,
      [
        { header: '员工姓名', key: 'employeeName' },
        { header: '项目', key: 'departmentName' },
        { header: '入职日期', key: 'joinDate', formatter: formatDate },
        { header: '状态', key: 'status', formatter: (v: string) => v === 'regular' ? '已转正' : '试用期' },
        { header: '转正日期', key: 'regularDate', formatter: formatDate },
        { header: '年份', key: 'year' },
        { header: '月份', key: 'month', formatter: (v: number) => `${v}月` },
        { header: '基础工资', key: 'baseSalaryCents', formatter: formatAmountCents },
        { header: '工作天数', key: 'workDays' },
        { header: '请假天数', key: 'leaveDays', formatter: (v: number) => v ? `${v.toFixed(1)}天` : '-' },
        { header: '月总天数', key: 'daysInMonth' },
        { header: '应发工资', key: 'actualSalaryCents', formatter: formatAmountCents },
      ],
      `薪资报表_${y}${month ? `_${month}` : ''}`
    )

    return createCSVResponse(csvContent, `薪资报表_${y}${month ? `_${month}` : ''}`)
  }
)

// 操作历史查询
app.openapi(
  createRoute({
    method: 'get',
    path: '/operation-history',
    tags: ['Reports'],
    summary: 'Get operation history for entity',
    request: {
      query: z.object({
        entityType: z.string(),
        entityId: z.string(),
        limit: z.coerce.number().optional().default(50),
      }),
    },
    responses: {
      200: {
        description: 'Operation history',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              data: z.array(z.any()),
            }),
          },
        },
      },
    },
  }),
  createRouteHandler(async (c: any) => {
    const permCtx = createPermissionContext(c)
    if (!permCtx || (!permCtx.hasPermission(PermissionModule.REPORT, 'finance', PermissionAction.VIEW) && !permCtx.hasPermission(PermissionModule.REPORT, 'hr', PermissionAction.VIEW))) {
      throw Errors.FORBIDDEN()
    }
    const { entityType, entityId, limit } = c.req.valid('query')
    const operationHistoryService = c.var.services.operationHistory
    const history = await operationHistoryService.getEntityHistory(entityType, entityId, limit)
    return history
  }) as any
)

export default app
