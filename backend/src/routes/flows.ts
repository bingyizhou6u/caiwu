import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserEmployee } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createCashFlowSchema } from '../schemas/business.schema.js'
import { dateQuerySchema } from '../schemas/common.schema.js'
import type { R2Bucket } from '@cloudflare/workers-types'

export const flowsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schemas
const cashFlowResponseSchema = z.object({
  id: z.string(),
  voucher_no: z.string().nullable(),
  biz_date: z.string(),
  type: z.enum(['income', 'expense']),
  account_id: z.string(),
  category_id: z.string().nullable(),
  method: z.string().nullable(),
  amount_cents: z.number(),
  site_id: z.string().nullable(),
  department_id: z.string().nullable(),
  counterparty: z.string().nullable(),
  memo: z.string().nullable(),
  voucher_urls: z.array(z.string()),
  voucher_url: z.string().nullable(), // Backward compatibility
  created_by: z.string().nullable(),
  created_at: z.number().nullable(),
  account_name: z.string().nullable(),
  category_name: z.string().nullable()
})

const listCashFlowsResponseSchema = z.object({
  results: z.array(cashFlowResponseSchema)
})

const nextVoucherResponseSchema = z.object({
  voucher_no: z.string()
})

const uploadVoucherResponseSchema = z.object({
  url: z.string(),
  key: z.string()
})

const updateVoucherSchema = z.object({
  voucher_urls: z.array(z.string()).optional(),
  voucher_url: z.string().optional()
})

// Routes

// Get Next Voucher No
flowsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/flows/next-voucher',
    summary: 'Get next voucher number',
    request: {
      query: dateQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: nextVoucherResponseSchema
          }
        },
        description: 'Next voucher number'
      }
    }
  }),
  async (c) => {
    const { date } = c.req.valid('query')
    const voucherNo = await c.var.services.finance.getNextVoucherNo(date)
    return c.json({ voucher_no: voucherNo })
  }
)

// List Cash Flows
flowsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/flows',
    summary: 'List cash flows',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: listCashFlowsResponseSchema
          }
        },
        description: 'List of cash flows'
      }
    }
  }),
  async (c) => {
    if (!getUserPosition(c)) throw Errors.FORBIDDEN()

    // Note: The service currently implements a basic list. 
    // Complex filtering logic from original route (getDataAccessFilter) needs to be preserved or moved to service.
    // For now, let's keep the complex query logic here or move it to service later.
    // Given the task is to use FinanceService, I should probably enhance FinanceService to support this, 
    // but the original code had raw SQL with dynamic where clauses.
    // To stick to the plan of using FinanceService, I will use the service's listCashFlows 
    // but I might need to pass the raw SQL or build it there.
    // However, the service implementation I wrote earlier was simple.
    // Let's use the service but maybe I need to update the service to accept more filters?
    // Or I can keep the raw SQL here for now if the service is not ready for complex filtering.
    // But the goal is refactoring.
    // Let's use the raw SQL approach here for now to ensure no regression in filtering, 
    // as moving dynamic SQL construction to Drizzle/Service properly is a bigger task.
    // Wait, I can use Drizzle's query builder in the service if I pass the conditions.
    // But `getDataAccessFilter` returns a SQL string and binds.
    // So I will stick to the original implementation for the list endpoint for now, 
    // OR I can move this logic to the service.
    // Let's move the logic to the service? No, `getDataAccessFilter` is a utility that returns raw SQL parts.
    // I will call `c.env.DB` directly here for the list to ensure correctness, 
    // as `FinanceService.listCashFlows` I wrote is too simple.
    // I will mark this as a TODO for future service enhancement.

    // Actually, I can use the service if I update it. But I can't update it right now without context switching.
    // So I will keep the raw SQL for the list endpoint but wrap the result processing.

    // Custom filter logic for cash_flows instead of generic getDataAccessFilter
    // because cash_flows table structure differs from employees (no org_department_id)

    const position = getUserPosition(c)
    const employee = getUserEmployee(c)

    let whereClause = sql`1=1`

    if (position && employee) {
      if (position.level === 2) {
        // Project level: filter by department_id
        if (employee.department_id) {
          whereClause = sql`cash_flows.department_id = ${employee.department_id}`
        } else {
          whereClause = sql`1=0`
        }
      } else if (position.level > 2) {
        // Team or lower: only see own created flows
        const userId = c.get('userId')
        whereClause = sql`cash_flows.created_by = ${userId}`
      }
      // Level 1 (HQ) sees all (1=1)
    } else {
      // No position/employee info? Should be forbidden but just in case
      whereClause = sql`1=0`
    }

    const rows = await c.var.services.finance.listCashFlows(200, whereClause)

    const results = rows.map(row => {
      const f = row.flow
      let voucherUrls: string[] = []
      if (f.voucherUrl) {
        try {
          const parsed = JSON.parse(f.voucherUrl)
          if (Array.isArray(parsed)) {
            voucherUrls = parsed
          } else {
            voucherUrls = [f.voucherUrl]
          }
        } catch (e) {
          voucherUrls = [f.voucherUrl]
        }
      }

      return {
        id: f.id,
        voucher_no: f.voucherNo,
        biz_date: f.bizDate,
        type: f.type,
        account_id: f.accountId,
        category_id: f.categoryId,
        method: f.method,
        amount_cents: f.amountCents,
        site_id: f.siteId,
        department_id: f.departmentId,
        counterparty: f.counterparty,
        memo: f.memo,
        voucher_url: voucherUrls[0] || null,
        voucher_urls: voucherUrls,
        created_by: f.createdBy,
        created_at: f.createdAt,
        account_name: row.accountName,
        category_name: row.categoryName
      }
    })

    return c.json({ results } as any)
  }
)

// Upload Voucher
flowsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/upload/voucher',
    summary: 'Upload voucher image',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.instanceof(File)
            })
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: uploadVoucherResponseSchema
          }
        },
        description: 'Uploaded file info'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'flow', 'create')) throw Errors.FORBIDDEN()

    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) throw Errors.VALIDATION_ERROR('文件必填')

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) throw Errors.VALIDATION_ERROR('文件过大（最大10MB）')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      throw Errors.VALIDATION_ERROR('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
    }

    if (file.type !== 'image/webp') {
      throw Errors.VALIDATION_ERROR('请在前端将图片转换为WebP格式后上传')
    }

    try {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const fileName = `${timestamp}-${random}.webp`
      const key = `vouchers/${fileName}`

      const bucket = c.env.VOUCHERS as unknown as R2Bucket
      await bucket.put(key, file as any, {
        httpMetadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000',
        },
        customMetadata: {
          originalName: file.name,
          originalType: file.type,
          uploadedAt: new Date().toISOString(),
        },
      })

      const url = `/api/vouchers/${key}`
      return c.json({ url, key })
    } catch (error: any) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw Errors.INTERNAL_ERROR(`上传失败: ${error.message}`)
    }
  }
)

// Download Voucher
flowsRoutes.get('/vouchers/*', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()

  const requestPath = c.req.path
  const fullPath = requestPath.replace('/api/vouchers/', '')

  if (!fullPath || !fullPath.startsWith('vouchers/')) {
    throw Errors.VALIDATION_ERROR(`无效路径: ${fullPath}`)
  }

  try {
    const bucket = c.env.VOUCHERS as unknown as R2Bucket
    const object = await bucket.get(fullPath)
    if (!object) {
      throw Errors.NOT_FOUND('凭证文件')
    }

    const headers = new Headers()
    headers.set('Content-Type', 'image/webp')
    headers.set('Cache-Control', 'public, max-age=31536000')

    return new Response(object.body as any, { headers })
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(`下载失败: ${error.message}`)
  }
})

// Create Cash Flow
flowsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/flows',
    summary: 'Create cash flow',
    request: {
      body: {
        content: {
          'application/json': {
            schema: createCashFlowSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ id: z.string(), voucher_no: z.string() })
          }
        },
        description: 'Created cash flow ID and voucher number'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'flow', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    // Logic for owner_scope and department_id
    let ownerScope = body.owner_scope as ('hq' | 'department' | undefined)
    let departmentId = body.department_id ?? null

    if (!departmentId && body.site_id) {
      // We need to look up department_id from site_id. 
      // Since FinanceService doesn't have this helper exposed directly, we can use DB or add it.
      // Let's use DB direct for this small lookup or assume service handles it?
      // The service createCashFlow takes departmentId.
      // Let's do the lookup here.
      const r = await c.env.DB.prepare('select department_id from sites where id=?').bind(body.site_id).first<{ department_id: string }>()
      if (r?.department_id) departmentId = r.department_id
    }

    if (ownerScope === 'hq') {
      departmentId = null
    } else if (ownerScope === 'department') {
      if (!departmentId) throw Errors.VALIDATION_ERROR('department所有者需要提供department_id或site_id')
    } else {
      if (!departmentId) ownerScope = 'hq'
      else ownerScope = 'department'
    }

    const result = await c.var.services.finance.createCashFlow({
      accountId: body.account_id,
      categoryId: body.category_id,
      bizDate: body.biz_date,
      type: body.type,
      amountCents: body.amount_cents,
      voucherUrls: body.voucher_urls ?? (body.voucher_url ? [body.voucher_url] : undefined),
      voucherNo: body.voucher_no,
      method: body.method,
      siteId: body.site_id,
      departmentId: departmentId,
      counterparty: body.counterparty,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'cash_flow', result.id, JSON.stringify({ voucher_no: result.voucherNo, type: body.type, amount_cents: body.amount_cents }))
    return c.json({ id: result.id, voucher_no: result.voucherNo })
  }
)

// Update Voucher
flowsRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/flows/{id}/voucher',
    summary: 'Update cash flow voucher',
    request: {
      params: z.object({
        id: z.string()
      }),
      body: {
        content: {
          'application/json': {
            schema: updateVoucherSchema
          }
        }
      }
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean() })
          }
        },
        description: 'Success'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'flow', 'update')) throw Errors.FORBIDDEN()
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    let voucherUrls: string[] = []
    if (body.voucher_urls && Array.isArray(body.voucher_urls)) {
      voucherUrls = body.voucher_urls.filter((url: string) => url && url.trim())
    } else if (body.voucher_url) {
      voucherUrls = [body.voucher_url]
    }
    if (voucherUrls.length === 0) throw Errors.VALIDATION_ERROR('voucher_urls参数必填')

    await c.var.services.finance.updateCashFlowVoucher(id, voucherUrls)

    logAuditAction(c, 'update', 'cash_flow', id, JSON.stringify({ voucher_urls: voucherUrls, action: 'update_voucher' }))
    return c.json({ ok: true })
  }
)
