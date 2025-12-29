import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission, getUserPosition, getUserEmployee, getDataAccessFilterSQL, canViewEmployee } from '../../utils/permissions.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { Errors } from '../../utils/errors.js'
import { logAuditAction } from '../../utils/audit.js'
import {
  EmployeeQuerySchema,
  UpdateEmployeeSchema,
  RegularizeEmployeeSchema,
  EmployeeLeaveSchema,
  EmployeeRejoinSchema,
  CreateEmployeeSchema,
  CreateEmployeeResponseSchema,
} from '../../schemas/employee.schema.js'
import { employees } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { apiSuccess } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const employeesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const listEmployeesRoute = createRoute({
  method: 'get',
  path: '/employees',
  summary: 'List employees',
  request: {
    query: EmployeeQuerySchema,
  },
  responses: {
    200: {
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
      description: 'List of employees',
    },
  },
})

employeesRoutes.openapi(
  listEmployeesRoute,
  createRouteHandler(async (c: any) => {
    const position = getUserPosition(c)
    if (!position) {
      throw Errors.FORBIDDEN()
    }

    const query = c.req.valid('query')
    const service = c.var.services.employee

    const filters: any = { ...query }
    const employee = c.get('userEmployee')

    // 使用统一的权限过滤工具函数
    // 使用 getDataAccessFilterSQL 获取安全的 SQL 对象
    const accessFilter = getDataAccessFilterSQL(c, 'employees', {
      deptColumn: 'projectId',
      orgDeptColumn: 'orgDepartmentId',
    })

    const results = await service.getAll(filters, accessFilter)
    return { results }
  }) as any
)

// 根据 ID 获取单个员工
const getEmployeeRoute = createRoute({
  method: 'get',
  path: '/employees/{id}',
  summary: 'Get employee by ID',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'employee-123' }),
    }),
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
      description: 'Employee details',
    },
  },
})

employeesRoutes.openapi(
  getEmployeeRoute,
  createRouteHandler(async (c: any) => {
    const { id } = c.req.valid('param')

    const position = getUserPosition(c)
    const employee = getUserEmployee(c)
    if (!position || !employee) {
      throw Errors.UNAUTHORIZED()
    }

    const canView = await c.var.services.permission.canViewEmployee(employee, position, id)

    if (!canView) {
      throw Errors.FORBIDDEN('无权查看该员工信息')
    }

    const result = await c.var.services.employee.getById(id)

    if (!result) {
      throw Errors.NOT_FOUND('员工')
    }

    return result
  })
)

// 创建员工（自动创建用户账号并发送欢迎邮件）
const createEmployeeRoute = createRoute({
  method: 'post',
  path: '/employees',
  summary: 'Create new employee with user account',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateEmployeeSchema,
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
            data: CreateEmployeeResponseSchema,
          }),
        },
      },
      description: 'Employee created with user account',
    },
  },
})

employeesRoutes.openapi(
  createEmployeeRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.CREATE)) {
      throw Errors.FORBIDDEN()
    }

    const body = c.req.valid('json')
    const service = c.var.services.employee

    const result = await service.create(
      {
        name: body.name,
        personalEmail: body.personalEmail,
        orgDepartmentId: body.orgDepartmentId,
        projectId: body.projectId,
        positionId: body.positionId,
        joinDate: body.joinDate,
        birthday: body.birthday,
        phone: body.phone,
        usdtAddress: body.usdtAddress,
        address: body.address,
        emergencyContact: body.emergencyContact,
        emergencyPhone: body.emergencyPhone,
        memo: body.memo,
        workSchedule: body.workSchedule,
        annualLeaveCycleMonths: body.annualLeaveCycleMonths,
        annualLeaveDays: body.annualLeaveDays,
      },
      c.env
    )

    logAuditAction(
      c,
      'create',
      'employee',
      result.id,
      JSON.stringify({
        name: body.name,
        personalEmail: body.personalEmail,
        companyEmail: result.email,
        userAccountCreated: result.user_account_created,
        emailSent: result.email_sent,
        emailRoutingCreated: result.email_routing_created,
      })
    )

    return {
      id: result.id,
      email: result.email,
      personalEmail: result.personalEmail,
      userAccountCreated: result.user_account_created,
      emailSent: result.email_sent,
      emailRoutingCreated: result.email_routing_created,
    }
  }) as any
)





const updateEmployeeRoute = createRoute({
  method: 'put',
  path: '/employees/{id}',
  summary: 'Update employee',
  request: {
    params: z.object({
      id: z.string().openapi({ example: '123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateEmployeeSchema,
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
      description: 'Employee updated',
    },
  },
})

employeesRoutes.openapi(
  updateEmployeeRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }

    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee

    const result = await service.update(id, {
      name: body.name,
      projectId: body.projectId,
      orgDepartmentId: body.orgDepartmentId,
      positionId: body.positionId,
      joinDate: body.joinDate,
      active: body.active,
      phone: body.phone,
      personalEmail: body.personalEmail,
      usdtAddress: body.usdtAddress,
      emergencyContact: body.emergencyContact,
      emergencyPhone: body.emergencyPhone,
      address: body.address,
      memo: body.memo,
      birthday: body.birthday,
      workSchedule: body.workSchedule,
      annualLeaveCycleMonths: body.annualLeaveCycleMonths,
      annualLeaveDays: body.annualLeaveDays,
    })

    logAuditAction(c, 'update', 'employee', id, JSON.stringify(body))

    return result
  }) as any
)

const regularizeEmployeeRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/regularize',
  summary: 'Regularize employee',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: RegularizeEmployeeSchema,
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
      description: 'Employee regularized',
    },
  },
})

employeesRoutes.openapi(
  regularizeEmployeeRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee
    const result = await service.regularize(id, body.regularDate)
    return result
  }) as any
)

const leaveEmployeeRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/leave',
  summary: 'Employee leave (resign)',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: EmployeeLeaveSchema,
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
      description: 'Employee resigned',
    },
  },
})

employeesRoutes.openapi(
  leaveEmployeeRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee
    const result = await service.leave(id, body.leaveDate, body.reason)
    return result
  }) as any
)

const rejoinEmployeeRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/rejoin',
  summary: 'Employee rejoin',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: EmployeeRejoinSchema,
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
      description: 'Employee rejoined',
    },
  },
})

employeesRoutes.openapi(
  rejoinEmployeeRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee
    const result = await service.rejoin(id, body.joinDate)
    return result
  }) as any
)



// ============================================
// 员工-项目关联管理 API
// ============================================

// 获取员工的项目关联列表
const getEmployeeProjectsRoute = createRoute({
  method: 'get',
  path: '/employees/{id}/projects',
  summary: '获取员工的项目关联列表',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.object({
              id: z.string(),
              employeeId: z.string(),
              projectId: z.string(),
              role: z.string().nullable(),
              isPrimary: z.number().nullable(),
              createdAt: z.number().nullable(),
              projectName: z.string().nullable(),
              projectCode: z.string().nullable(),
            })),
          }),
        },
      },
      description: '项目关联列表',
    },
  },
})

employeesRoutes.openapi(
  getEmployeeProjectsRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.VIEW)) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const projects = await c.var.services.employeeProject.getEmployeeProjects(id)
    return projects
  }) as any
)

// 添加员工的项目关联
const addEmployeeProjectRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/projects',
  summary: '添加员工的项目关联',
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.string().min(1, '项目ID不能为空'),
            role: z.string().optional(),
            isPrimary: z.boolean().optional(),
          }),
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
            message: z.string().optional(),
            id: z.string().optional(),
          }),
        },
      },
      description: '添加结果',
    },
  },
})

employeesRoutes.openapi(
  addEmployeeProjectRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await c.var.services.employeeProject.addEmployeeProject({
      employeeId: id,
      projectId: body.projectId,
      role: body.role,
      isPrimary: body.isPrimary,
    })
    return result
  }) as any
)

// 移除员工的项目关联
const removeEmployeeProjectRoute = createRoute({
  method: 'delete',
  path: '/employees/{id}/projects/{projectId}',
  summary: '移除员工的项目关联',
  request: {
    params: z.object({
      id: z.string(),
      projectId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string().optional(),
          }),
        },
      },
      description: '移除结果',
    },
  },
})

employeesRoutes.openapi(
  removeEmployeeProjectRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const { id, projectId } = c.req.valid('param')
    const result = await c.var.services.employeeProject.removeEmployeeProject(id, projectId)
    return result
  }) as any
)

// 设置员工的主项目
const setEmployeePrimaryProjectRoute = createRoute({
  method: 'patch',
  path: '/employees/{id}/projects/{projectId}/primary',
  summary: '设置员工的主项目',
  request: {
    params: z.object({
      id: z.string(),
      projectId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: '设置结果',
    },
  },
})

employeesRoutes.openapi(
  setEmployeePrimaryProjectRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.HR, 'employee', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const { id, projectId } = c.req.valid('param')
    const result = await c.var.services.employeeProject.setPrimaryProject(id, projectId)
    return result
  }) as any
)
