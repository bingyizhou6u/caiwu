import { z } from 'zod'

export const categorySchema = z.object({
    name: z.string().min(1, '类别名称不能为空').max(50, '类别名称过长'),
    kind: z.enum(['income', 'expense']),
})

export type CategoryFormData = z.infer<typeof categorySchema>
