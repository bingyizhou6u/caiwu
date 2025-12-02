import { z } from '@hono/zod-openapi'

export const EmployeeSchema = z.object({
    id: z.string().openapi({ example: '123' }),
    name: z.string().openapi({ example: 'John Doe' }),
    email: z.string().email().openapi({ example: 'john@example.com' }),
    departmentId: z.string().nullable().openapi({ example: 'dept-1' }),
    departmentName: z.string().nullable().optional(),
    orgDepartmentId: z.string().nullable().openapi({ example: 'org-dept-1' }),
    orgDepartmentName: z.string().nullable().optional(),
    positionId: z.string().nullable().openapi({ example: 'pos-1' }),
    positionName: z.string().nullable().optional(),
    status: z.string().nullable().openapi({ example: 'regular' }),
    active: z.number().nullable().openapi({ example: 1 }),
    joinDate: z.string().nullable().openapi({ example: '2023-01-01' }),
    phone: z.string().nullable().optional(),
    avatar: z.string().optional(),
})

export const EmployeeListSchema = z.object({
    results: z.array(EmployeeSchema)
})

export const EmployeeQuerySchema = z.object({
    status: z.string().optional(),
    departmentId: z.string().optional(),
    orgDepartmentId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    positionId: z.string().optional(),
    limit: z.string().transform(Number).optional().openapi({ example: '20' }),
    offset: z.string().transform(Number).optional().openapi({ example: '0' }),
})

export const MigrateUserSchema = z.object({
    user_id: z.string().openapi({ example: 'user-123' }),
    org_department_id: z.string().openapi({ example: 'org-dept-1' }),
    position_id: z.string().openapi({ example: 'pos-1' }),
    join_date: z.string().openapi({ example: '2023-01-01' }),
    probation_salary_cents: z.number().openapi({ example: 500000 }),
    regular_salary_cents: z.number().openapi({ example: 600000 }),
    birthday: z.string().optional().openapi({ example: '1990-01-01' }),
})

export const UpdateEmployeeSchema = z.object({
    name: z.string().optional(),
    department_id: z.string().optional(),
    org_department_id: z.string().optional(),
    position_id: z.string().optional(),
    join_date: z.string().optional(),
    probation_salary_cents: z.number().optional(),
    regular_salary_cents: z.number().optional(),
    living_allowance_cents: z.number().optional(),
    housing_allowance_cents: z.number().optional(),
    transportation_allowance_cents: z.number().optional(),
    meal_allowance_cents: z.number().optional(),
    active: z.number().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    usdt_address: z.string().optional(),
    emergency_contact: z.string().optional(),
    emergency_phone: z.string().optional(),
    address: z.string().optional(),
    memo: z.string().optional(),
    birthday: z.string().optional(),
    work_schedule: z.any().optional(),
    annual_leave_cycle_months: z.number().optional(),
    annual_leave_days: z.number().optional(),
})

export const RegularizeEmployeeSchema = z.object({
    regular_date: z.string().openapi({ example: '2023-04-01' }),
})

export const EmployeeLeaveSchema = z.object({
    leave_date: z.string().openapi({ example: '2023-12-31' }),
    reason: z.string().optional().openapi({ example: 'Personal reasons' }),
})

export const EmployeeRejoinSchema = z.object({
    join_date: z.string().openapi({ example: '2024-01-01' }),
})
