import { z } from 'zod'

export const siteSchema = z.object({
    department_id: z.string().min(1, '请选择所属项目'),
    name: z.string().min(1, '站点名称不能为空').max(100, '站点名称过长'),
    site_code: z.string().max(50, '站点编号过长').optional(),
    theme_style: z.string().max(50, '版面风格过长').optional(),
    theme_color: z.string().max(20, '版面颜色过长').optional(),
    frontend_url: z.string().url('前台网址格式不正确').optional().or(z.literal('')),
    active: z.boolean().optional(),
})

export type SiteFormData = z.infer<typeof siteSchema>
