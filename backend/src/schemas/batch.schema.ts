import { z } from '@hono/zod-openapi'

/**
 * 通用批量操作请求 Schema
 */
export const batchOperationSchema = z.object({
  ids: z.array(z.string()).min(1, '至少选择一项'),
  operation: z.enum(['delete', 'activate', 'deactivate'], {
    errorMap: () => ({ message: '不支持的操作类型' }),
  }),
})

export type BatchOperationParams = z.infer<typeof batchOperationSchema>

/**
 * 通用批量操作响应 Schema
 */
export const batchResponseSchema = z.object({
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  failures: z
    .array(
      z.object({
        id: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
})

export type BatchResponse = z.infer<typeof batchResponseSchema>
