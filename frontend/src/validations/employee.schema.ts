import { z } from 'zod'
import dayjs from 'dayjs'

export const createEmployeeSchema = z.object({
    name: z.string().min(1, '请输入姓名'),
    project_id: z.string().min(1, '请选择项目归属或总部'),
    orgDepartmentId: z.string().min(1, '请选择部门'),
    departmentId: z.string().optional(),
    positionId: z.string().min(1, '请选择职位'),
    joinDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的入职日期'),
    regularDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的转正日期'),
    birthday: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的生日'),
    workSchedule: z.any().optional(),
    annualLeaveCycleMonths: z.number().optional(),
    annualLeaveDays: z.number().optional(),
    personalEmail: z.string().email('请输入正确的个人邮箱地址'),
    phone_country_code: z.string().optional(),
    phone_number: z.string().optional(),
    usdtAddress: z.string().optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone_country_code: z.string().optional(),
    emergencyPhone_number: z.string().optional(),
    memo: z.string().optional(),
    probation_salaries: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).min(1, '请至少填写一种试用薪资'),
    regular_salaries: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).min(1, '请至少填写一种转正薪资'),
    living_allowances: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
    housing_allowances: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
    transportation_allowances: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
    meal_allowances: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
})

export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
    // 基本信息 - 如果提供则验证
    name: z.string().optional(),
    project_id: z.any().optional(),
    orgDepartmentId: z.any().optional(),
    departmentId: z.any().optional(),
    positionId: z.any().optional(),
    joinDate: z.any().optional(),
    regularDate: z.any().optional(),
    birthday: z.any().optional(),
    workSchedule: z.any().optional(),
    annualLeaveCycleMonths: z.any().optional(),
    annualLeaveDays: z.any().optional(),
    active: z.any().optional(),

    // 联系方式 - 全部可选
    email: z.any().optional(),
    phone_country_code: z.any().optional(),
    phone_number: z.any().optional(),
    usdtAddress: z.any().optional(),
    address: z.any().optional(),
    emergencyContact: z.any().optional(),
    emergencyPhone_country_code: z.any().optional(),
    emergencyPhone_number: z.any().optional(),
    memo: z.any().optional(),
    probation_salaries: z.any().optional(),
    regular_salaries: z.any().optional(),
    living_allowances: z.any().optional(),
    housing_allowances: z.any().optional(),
    transportation_allowances: z.any().optional(),
    meal_allowances: z.any().optional(),
}).passthrough() // 允许额外字段通过

export type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>

export const employeeRegularizeSchema = z.object({

    regularDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的转正日期'),
})

export const employeeLeaveSchema = z.object({
    leaveDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的离职日期'),
    leaveType: z.enum(['resigned', 'terminated', 'expired', 'retired', 'other']),
    leaveReason: z.string().optional(),
    leaveMemo: z.string().optional(),
    disableAccount: z.boolean().optional(),
})

export const employeeRejoinSchema = z.object({
    joinDate: z.any().refine((val) => val && dayjs(val).isValid(), '请选择有效的入职日期'),
    enableAccount: z.boolean().optional(),
})

export const salaryConfigSchema = z.object({
    salaries: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
})

export const allowanceConfigSchema = z.object({
    allowances: z.array(z.object({
        currencyId: z.string().optional(),
        amountCents: z.number().min(0).optional(),
    })).optional(),
})

export const resetUserSchema = z.object({
    password: z.string().min(6, '密码长度不能少于6位'),
    confirm_password: z.string().min(6, '密码长度不能少于6位'),
}).refine((data) => data.password === data.confirm_password, {
    message: "两次输入的密码不一致",
    path: ["confirm_password"],
})
