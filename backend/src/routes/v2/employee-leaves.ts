import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { getUserPosition, hasPermission } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const employeesLeavesRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const LeaveSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string().nullable().optional(),
  leaveType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string().nullable(),
  reason: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedAt: z.number().optional().nullable(),
  createdAt: z.number().optional().nullable(),
  updatedAt: z.number().optional().nullable(),
})

const CreateLeaveSchema = z.object({
  employeeId: z.string(),
  leaveType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  reason: z.string().optional(),
  memo: z.string().optional(),
})

const UpdateLeaveStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  memo: z.string().optional(),
})

// 获取请假列表
const listEmployeeLeavesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Employee Leaves'],
  summary: 'List employee leaves',
  request: {
    query: z.object({
      employeeId: z.string().optional(),
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
              results: z.array(LeaveSchema),
            }),
          }),
        },
      },
      description: 'List of employee leaves',
    },
  },
})

employeesLeavesRoutes.openapi(
  listEmployeeLeavesRoute,
  createRouteHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { employeeId, status } = c.req.valid('query')
    const results = await c.var.services.employeeLeave.listLeaves({ employeeId, status })
    return { results }
  })
)

// 创建请假申请
const createEmployeeLeaveRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Employee Leaves'],
  summary: 'Create employee leave',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateLeaveSchema,
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
            data: LeaveSchema,
          }),
        },
      },
      description: 'Created employee leave',
    },
  },
})

employeesLeavesRoutes.openapi(
  createEmployeeLeaveRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'leave', 'create')) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')
    const newLeave = await c.var.services.employeeLeave.createLeave(body)
    return newLeave
  })
)

// 更新请假状态
const updateEmployeeLeaveStatusRoute = createRoute({
  method: 'put',
  path: '/{id}/status',
  tags: ['Employee Leaves'],
  summary: 'Update employee leave status',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateLeaveStatusSchema,
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
            data: z.object({ success: z.boolean() }),
          }),
        },
      },
      description: 'Updated employee leave status',
    },
  },
})

employeesLeavesRoutes.openapi(
  updateEmployeeLeaveStatusRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, 'hr', 'leave', 'approve')) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const { status, memo } = c.req.valid('json') as { status: string; memo?: string }
    const userId = c.get('employeeId')

    await c.var.services.employeeLeave.updateLeaveStatus(id, status, {
      approvedBy: userId || undefined,
      memo: memo || undefined,
    })

    return { success: true }
  }) as any
)
