import { z } from 'zod'
import dayjs from 'dayjs'

export const createEmployeeSchema = z.object({
    name: z.string().min(1, '请输入姓名'),
    project_id: z.string().min(1, '请选择项目归属或总部'),
    org_department_id: z.string().min(1, '请选择部门'),
    department_id: z.string().optional(),
    position_id: z.string().min(1, '请选择职位'),
    join_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的入职日期'),
    birthday: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的生日'),
    work_schedule: z.any().optional(),
    annual_leave_cycle_months: z.number().optional(),
    annual_leave_days: z.number().optional(),
    email: z.string().email('请输入正确的邮箱地址'),
    phone_country_code: z.string().optional(),
    phone_number: z.string().optional(),
    usdt_address: z.string().optional(),
    address: z.string().optional(),
    emergency_contact: z.string().optional(),
    emergency_phone_country_code: z.string().optional(),
    emergency_phone_number: z.string().optional(),
    memo: z.string().optional(),
    probation_salaries: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
    regular_salaries: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
    living_allowances: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
    housing_allowances: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
    transportation_allowances: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
    meal_allowances: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
})

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
    name: z.string().min(1, '请输入姓名'),
    project_id: z.string().optional(),
    org_department_id: z.string().min(1, '请选择部门'),
    department_id: z.string().optional(),
    position_id: z.string().min(1, '请选择职位'),
    join_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的入职日期'),
    birthday: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的生日'),
    work_schedule: z.any().optional(),
    annual_leave_cycle_months: z.number().optional(),
    annual_leave_days: z.number().optional(),
    email: z.string().email('请输入正确的邮箱地址'),
    phone_country_code: z.string().optional(),
    phone_number: z.string().optional(),
    usdt_address: z.string().optional(),
    address: z.string().optional(),
    emergency_contact: z.string().optional(),
    emergency_phone_country_code: z.string().optional(),
    emergency_phone_number: z.string().optional(),
    memo: z.string().optional(),
    active: z.number().optional(),
    probation_salary_cents: z.number().min(0).optional(),
    regular_salary_cents: z.number().min(0).optional(),
    living_allowance_cents: z.number().min(0).optional(),
    housing_allowance_cents: z.number().min(0).optional(),
    transportation_allowance_cents: z.number().min(0).optional(),
    meal_allowance_cents: z.number().min(0).optional(),
})

export type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>

export const employeeRegularizeSchema = z.object({

    regular_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的转正日期'),
})

export const employeeLeaveSchema = z.object({
    leave_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的离职日期'),
    leave_type: z.enum(['resigned', 'terminated', 'expired', 'retired', 'other']),
    leave_reason: z.string().optional(),
    leave_memo: z.string().optional(),
    disable_account: z.boolean().optional(),
})

export const employeeRejoinSchema = z.object({
    join_date: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的入职日期'),
    enable_account: z.boolean().optional(),
})

export const salaryConfigSchema = z.object({
    salaries: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
})

export const allowanceConfigSchema = z.object({
    allowances: z.array(z.object({
        currency_id: z.string().optional(),
        amount_cents: z.number().min(0).optional(),
    })).optional(),
})

export const resetUserSchema = z.object({
    password: z.string().min(6, '密码长度不能少于6位'),
    confirm_password: z.string().min(6, '密码长度不能少于6位'),
}).refine((data) => data.password === data.confirm_password, {
    message: "两次输入的密码不一致",
    path: ["confirm_password"],
})
