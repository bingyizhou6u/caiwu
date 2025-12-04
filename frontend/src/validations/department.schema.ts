import { z } from 'zod'

export const departmentSchema = z.object({
    name: z.string().min(1, '项目名称不能为空').max(50, '项目名称过长'),
    active: z.boolean().optional(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
