import { z } from 'zod'

export const siteSchema = z.object({
    departmentId: z.string().min(1, '请选择所属项目'),
    name: z.string().min(1, '站点名称不能为空').max(100, '站点名称过长'),
    siteCode: z.string().max(50, '站点编号过长').optional(),
    themeStyle: z.string().max(50, '版面风格过长').optional(),
    themeColor: z.string().max(20, '主题色过长').optional(),
    frontendUrl: z.string().url('前台网址格式不正确').optional().or(z.literal('')),
    active: z.boolean().optional(),
})

export type SiteFormData = z.infer<typeof siteSchema>
