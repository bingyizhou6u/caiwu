import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'
import { csvImportQuerySchema } from '../schemas/common.schema.js'

export const importRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

const importCsvRoute = createRoute({
  method: 'post',
  path: '/import',
  summary: 'Import data from CSV',
  request: {
    query: csvImportQuerySchema,
    body: {
      content: {
        'text/plain': {
          schema: z.string()
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Import successful'
    },
    400: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Validation error'
    },
    403: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Forbidden'
    }
  }
})

importRoutes.openapi(importCsvRoute, async (c) => {
  if (!hasPermission(c, 'finance', 'flow', 'create')) throw Errors.FORBIDDEN()

  const { kind } = c.req.valid('query')
  const csvContent = await c.req.text()
  const userId = c.get('userId') as string

  if (kind === 'flows') {
    const result = await c.get('services').import.importFlows(csvContent, userId)
    return c.json(result)
  }

  throw Errors.VALIDATION_ERROR(`Unsupported import kind: ${kind}`)
})
