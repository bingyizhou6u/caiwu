import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../../types/index.js'
import { hasPermission } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { csvImportQuerySchema } from '../../schemas/common.schema.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

export const importRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

const importCsvRoute = createRoute({
  method: 'post',
  path: '/import',
  summary: 'Import data from CSV',
  request: {
    query: csvImportQuerySchema,
    body: {
      content: {
        'text/plain': {
          schema: z.string(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'Import successful',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.any().optional(),
            }),
          }),
        },
      },
      description: 'Validation error',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.any().optional(),
            }),
          }),
        },
      },
      description: 'Forbidden',
    },
  },
})

importRoutes.openapi(importCsvRoute, createRouteHandler(async (c: any) => {
  if (!hasPermission(c, 'finance', 'flow', 'create')) {
      throw Errors.FORBIDDEN()
    }

  const { kind } = c.req.valid('query') as { kind: string }
  const csvContent = await c.req.text()
  const userId = c.get('userId') as string

  if (kind === 'flows') {
    return await c.var.services.import.importFlows(csvContent, userId)
  }

  throw Errors.VALIDATION_ERROR(`Unsupported import kind: ${kind}`)
}) as any)
