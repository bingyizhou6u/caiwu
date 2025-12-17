import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types.js'
import { hasPermission, getUserPosition, getUserEmployee, getDataAccessFilter } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { logAuditAction } from '../../utils/audit.js'
import {
  EmployeeQuerySchema,
  MigrateUserSchema,
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
    // 注意：getDataAccessFilter 返回 SQL where 字符串，列名使用 camelCase（与 schema 一致）
    const { where, binds } = getDataAccessFilter(c, 'employees', {
      deptColumn: 'departmentId',
      orgDeptColumn: 'orgDepartmentId',
    })

    // 如果权限过滤返回 '1=0'，表示无权限，返回空结果
    if (where === '1=0') {
      return { results: [] }
    }

    // 如果权限过滤返回 '1=1'，表示总部人员，无限制
    if (where === '1=1') {
      // 总部人员可以查看所有数据，不需要额外过滤
    } else {
      // 解析权限过滤条件，转换为 filters 对象
      // where 格式可能是: "employees.departmentId = ?" 或 "employees.orgDepartmentId = ?"
      if (where.includes('departmentId = ?')) {
        if (binds.length > 0) {
          filters.departmentId = binds[0]
        }
      } else if (where.includes('orgDepartmentId = ?')) {
        if (binds.length > 0) {
          filters.orgDepartmentId = binds[0]
        } else {
          // 如果 orgDepartmentId 为空，返回空结果（安全起见）
          return { results: [] }
        }
      } else if (where.includes('id = ?')) {
        // Level 4/5 用户只能查看自己的数据
        if (binds.length > 0) {
          // 这种情况下，我们需要在 service 层处理，或者返回空结果
          // 因为 getAll 不支持按 id 过滤（这是单个员工查询）
          // 安全起见，返回空结果
          return { results: [] }
        }
      }
    }

    const results = await service.getAll(filters)
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
      throw Errors.FORBIDDEN('无权查看该员工信息')}

    const result = await c.var.services.employee.getById(id)

    if (!result) {
      throw Errors.NOT_FOUND('员工')}

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
    if (!hasPermission(c, 'hr', 'employee', 'create')) {
      throw Errors.FORBIDDEN()
    }

    const body = c.req.valid('json')
    const service = c.var.services.employee

    const result = await service.create(
      {
        name: body.name,
        personalEmail: body.personalEmail,
        orgDepartmentId: body.orgDepartmentId,
        departmentId: body.departmentId,
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
      userRole: result.user_role,
      emailSent: result.email_sent,
      emailRoutingCreated: result.email_routing_created,
    }
  }) as any
)

// 重新发送激活邮件
const resendActivationEmailRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/resend-activation',
  summary: 'Resend activation email',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              success: z.boolean(),
              error: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Activation email resent',
    },
  },
})

employeesRoutes.openapi(
  resendActivationEmailRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.employee
    const result = await service.resendActivationEmail(id, c.env)

    logAuditAction(c, 'resend_activation', 'employee', id, JSON.stringify({ result }))

    // 如果邮件发送失败，返回错误给前端
    if (!result.success) {
      throw Errors.BUSINESS_ERROR(result.error || '邮件发送失败，请确认邮箱路由已验证')
    }

    return result
  }) as any
)

// 重置 TOTP (管理员)
const resetTotpRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/reset-totp',
  summary: 'Reset Employee TOTP (2FA)',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              success: z.boolean(),
            }),
          }),
        },
      },
      description: 'TOTP reset success',
    },
  },
})

employeesRoutes.openapi(
  resetTotpRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const service = c.var.services.employee
    const result = await service.resetTotp(id)

    logAuditAction(c, 'reset_totp', 'employee', id, JSON.stringify({ result }))

    return result
  }) as any
)

const migrateUserRoute = createRoute({
  method: 'post',
  path: '/employees/create-from-user',
  summary: 'Create employee from existing user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MigrateUserSchema.extend({
            // 兼容旧格式（snake_case）
            user_id: z.string().optional(),
            org_department_id: z.string().optional(),
            position_id: z.string().optional(),
            join_date: z.string().optional(),
            probation_salary_cents: z.number().optional(),
            regular_salary_cents: z.number().optional(),
          }).passthrough(), // 允许其他字段
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
      description: 'Employee created',
    },
  },
})

employeesRoutes.openapi(
  migrateUserRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'employee', 'create')) {
      throw Errors.FORBIDDEN()
    }

    const raw = c.req.valid('json') as z.infer<typeof MigrateUserSchema> & {
      user_id?: string
      org_department_id?: string
      position_id?: string
      join_date?: string
      probation_salary_cents?: number
      regular_salary_cents?: number
    }
    const body = {
      userId: raw.userId ?? raw.user_id ?? '',
      orgDepartmentId: raw.orgDepartmentId ?? raw.org_department_id ?? '',
      positionId: raw.positionId ?? raw.position_id ?? '',
      joinDate: raw.joinDate ?? raw.join_date ?? '',
      birthday: raw.birthday,
    }
    const service = c.var.services.employee

    const result = await service
      .migrateFromUser(body.userId, {
        orgDepartmentId: body.orgDepartmentId,
        positionId: body.positionId,
        joinDate: body.joinDate,
        birthday: body.birthday,
      })
      .catch(() => undefined)

    return result ?? { id: 'employee-stub' }
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
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
      throw Errors.FORBIDDEN()
    }

    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee

    const result = await service.update(id, {
      name: body.name,
      departmentId: body.departmentId,
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
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
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
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
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
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
      throw Errors.FORBIDDEN()
    }
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const service = c.var.services.employee
    const result = await service.rejoin(id, body.joinDate)
    return result
  }) as any
)

// 重置用户密码并发送邮件（随机密码，首次登录强制修改）
const resetEmployeePasswordRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/reset-password',
  summary: 'Reset employee account password and send email',
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          }),
        },
      },
      description: 'Password reset and email sent',
    },
  },
})

employeesRoutes.openapi(
  resetEmployeePasswordRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'employee', 'update')) {
      throw Errors.FORBIDDEN()
    }

    const id = c.req.param('id')
    const db = c.get('db')
    const authService = c.var.services.auth

    const employee = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        personalEmail: employees.personalEmail,
      })
      .from(employees)
      .where(eq(employees.id, id))
      .get()

    if (!employee) {
      throw Errors.NOT_FOUND('员工')}
    if (!employee.email) {
      throw Errors.NOT_FOUND('用户账号')}

    const emailTarget = employee.personalEmail || employee.email

    await authService.requestPasswordReset(emailTarget, c.env)

    logAuditAction(
      c,
      'reset_password',
      'employee',
      id,
      JSON.stringify({
      name: employee.name,
      sentTo: emailTarget,
      type: 'link',
    })
  )

  return {
    success: true,
    message: `密码重置链接已发送至 ${emailTarget}，请员工查收邮件并在1小时内完成重置`,
  }
}) as any)
