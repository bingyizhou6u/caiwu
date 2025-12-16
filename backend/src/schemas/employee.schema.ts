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
  results: z.array(EmployeeSchema),
})

export const EmployeeQuerySchema = z.object({
  status: z.string().optional(),
  departmentId: z.string().optional(),
  orgDepartmentId: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  positionId: z.string().optional(),
  activeOnly: z.string().optional(),
  limit: z.string().transform(Number).optional().openapi({ example: '20' }),
  offset: z.string().transform(Number).optional().openapi({ example: '0' }),
})

export const MigrateUserSchema = z.object({
  userId: z.string().openapi({ example: 'user-123' }),
  orgDepartmentId: z.string().openapi({ example: 'org-dept-1' }),
  positionId: z.string().openapi({ example: 'pos-1' }),
  joinDate: z.string().openapi({ example: '2023-01-01' }),
  // Salary data now managed via employee_salaries table
  birthday: z.string().optional().openapi({ example: '1990-01-01' }),
})

export const UpdateEmployeeSchema = z.object({
  name: z.string().optional(),
  departmentId: z.string().optional(),
  orgDepartmentId: z.string().optional(),
  positionId: z.string().optional(),
  joinDate: z.string().optional(),
  // Salary/allowance data now managed via employee_salaries and employee_allowances tables
  active: z.number().optional(),
  phone: z.string().optional(),
  personalEmail: z.string().email().optional(),
  usdtAddress: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  address: z.string().optional(),
  memo: z.string().optional(),
  birthday: z.string().optional(),
  workSchedule: z.any().optional(),
  annualLeaveCycleMonths: z.number().optional(),
  annualLeaveDays: z.number().optional(),
})

export const RegularizeEmployeeSchema = z.object({
  regularDate: z.string().openapi({ example: '2023-04-01' }),
})

export const EmployeeLeaveSchema = z.object({
  leaveDate: z.string().openapi({ example: '2023-12-31' }),
  reason: z.string().optional().openapi({ example: 'Personal reasons' }),
})

export const EmployeeRejoinSchema = z.object({
  joinDate: z.string().openapi({ example: '2024-01-01' }),
})

export const CreateEmployeeSchema = z.object({
  name: z.string().min(1).openapi({ example: '张三' }),
  personalEmail: z
    .string()
    .email()
    .openapi({ example: 'zhangsan@gmail.com', description: '员工真实邮箱，用于接收转发的邮件' }),
  orgDepartmentId: z.string().openapi({ example: 'org-dept-1' }),
  departmentId: z.string().optional().openapi({ example: 'dept-1' }),
  positionId: z.string().openapi({ example: 'pos-1' }),
  joinDate: z.string().openapi({ example: '2024-01-01' }),
  birthday: z.string().optional().openapi({ example: '1990-01-01' }),
  phone: z.string().optional(),
  usdtAddress: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  memo: z.string().optional(),
  workSchedule: z.any().optional(),
  annualLeaveCycleMonths: z.number().optional(),
  annualLeaveDays: z.number().optional(),
  probationSalaries: z
    .array(
      z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().optional(),
      })
    )
    .optional(),
  regularSalaries: z
    .array(
      z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().optional(),
      })
    )
    .optional(),
})

export const CreateEmployeeResponseSchema = z.object({
  id: z.string(),
  email: z.string().optional().openapi({ description: '系统生成的公司邮箱 @cloudflarets.com' }),
  personalEmail: z.string().optional().openapi({ description: '员工真实邮箱' }),
  userAccountCreated: z.boolean().optional(),
  userRole: z.string().optional(),
  emailSent: z.boolean().optional(),
  emailRoutingCreated: z.boolean().optional(),
})
