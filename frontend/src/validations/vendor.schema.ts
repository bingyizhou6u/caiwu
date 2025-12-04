import { z } from 'zod'

export const vendorSchema = z.object({
    name: z.string().min(1, '供应商名称不能为空').max(100, '供应商名称过长'),
    contact: z.string().max(100, '联系方式过长').optional(),
})

export type VendorFormData = z.infer<typeof vendorSchema>
