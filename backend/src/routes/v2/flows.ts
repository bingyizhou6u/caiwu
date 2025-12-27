import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../../types/index.js'
import {
  hasPermission,
  getUserPosition,
  getUserEmployee,
  getDataAccessFilterSQL,
} from '../../utils/permissions.js'
import { PermissionModule, PermissionAction } from '../../constants/permissions.js'
import { logAuditAction } from '../../utils/audit.js'
import { Errors } from '../../utils/errors.js'
import { createCashFlowSchema } from '../../schemas/business.schema.js'
import { dateQuerySchema, paginationSchema } from '../../schemas/common.schema.js'
import { apiSuccess } from '../../utils/response.js'
import { getPagination } from '../../utils/pagination.js'
import { createRouteHandler, createPaginatedHandler, parsePagination } from '../../utils/route-helpers.js'
import type { R2Bucket } from '@cloudflare/workers-types'

export const flowsRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Schema 定义
const cashFlowResponseSchema = z.object({
  id: z.string(),
  voucherNo: z.string().nullable(),
  bizDate: z.string(),
  type: z.enum(['income', 'expense', 'borrowing_in', 'lending_out', 'repayment_in', 'repayment_out']),
  accountId: z.string(),
  categoryId: z.string().nullable(),
  method: z.string().nullable(),
  amountCents: z.number(),
  siteId: z.string().nullable(),
  projectId: z.string().nullable(),
  counterparty: z.string().nullable(),
  memo: z.string().nullable(),
  voucherUrls: z.array(z.string()),
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  accountName: z.string().nullable(),
  categoryName: z.string().nullable(),
})

const nextVoucherResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    voucherNo: z.string(),
  }),
})

const uploadVoucherResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    url: z.string(),
    key: z.string(),
  }),
})

const updateVoucherSchema = z.object({
  voucherUrls: z.array(z.string()).optional(),
  voucherUrl: z.string().optional(),
})

// 获取下一个凭证号
const nextVoucherRoute = createRoute({
  method: 'get',
  path: '/flows/next-voucher',
  summary: 'Get next voucher number',
  request: {
    query: dateQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: nextVoucherResponseSchema,
        },
      },
      description: 'Next voucher number',
    },
  },
})

flowsRoutes.openapi(
  nextVoucherRoute,
  createRouteHandler(async (c: any) => {
    const { date } = c.req.valid('query')
    const voucherNo = await c.var.services.finance.getNextVoucherNo(date)
    return { voucherNo }
  }) as any
)

// 获取现金流水列表
const listCashFlowsRoute = createRoute({
  method: 'get',
  path: '/flows',
  summary: 'List cash flows',
  request: {
    query: paginationSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              items: z.array(cashFlowResponseSchema),
              pagination: z.object({
                page: z.number(),
                pageSize: z.number(),
                total: z.number(),
                totalPages: z.number(),
              }),
            }),
          }),
        },
      },
      description: 'List of cash flows',
    },
  },
})

flowsRoutes.openapi(
  listCashFlowsRoute,
  createPaginatedHandler(async (c: any) => {
    if (!getUserPosition(c)) {
      throw Errors.FORBIDDEN()
    }
    const { page, limit } = parsePagination(c)

    // 使用 getDataAccessFilterSQL 获取数据访问过滤条件（返回 SQL 对象，更安全）
    // cash_flows 表使用 'created_by' 和 'project_id' 列
    // 它没有 org_department_id，所以我们跳过那一层
    const accessFilter = getDataAccessFilterSQL(c, 'cash_flows', {
      ownerColumn: 'created_by',
      deptColumn: 'project_id',
      skipOrgDept: true,
    })

    const whereClause = accessFilter

    const { total, list } = await c.var.services.finance.listCashFlows(page, limit, whereClause)

    const items = list.map((row: any) => {
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
        voucherNo: f.voucherNo,
        bizDate: f.bizDate,
        type: f.type,
        accountId: f.accountId,
        categoryId: f.categoryId,
        method: f.method,
        amountCents: f.amountCents,
        siteId: f.siteId,
        projectId: f.projectId,
        counterparty: f.counterparty,
        memo: f.memo,
        voucherUrl: voucherUrls[0] || null,
        voucherUrls: voucherUrls,
        createdBy: f.createdBy,
        createdAt: f.createdAt,
        accountName: row.accountName,
        categoryName: row.categoryName,
      }
    })

    return { items, total }
  }) as any
)

// 上传凭证
const uploadVoucherRoute = createRoute({
  method: 'post',
  path: '/upload/voucher',
  summary: 'Upload voucher image',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: uploadVoucherResponseSchema,
        },
      },
      description: 'Uploaded file info',
    },
  },
})

flowsRoutes.openapi(
  uploadVoucherRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.FINANCE, 'flow', PermissionAction.CREATE)) {
      throw Errors.FORBIDDEN()
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) {
      throw Errors.VALIDATION_ERROR('文件必填')
    }

    // 使用文件验证工具（包含 Magic Number 检查）
    const { validateImageFile, generateSafeFileName } = await import('../../utils/file-validation.js')
    
    // 验证文件（仅允许 WebP）
    const validation = await validateImageFile(file, ['image/webp'])
    if (!validation.valid) {
      throw Errors.VALIDATION_ERROR(validation.error || '文件验证失败')
    }

    if (file.type !== 'image/webp') {
      throw Errors.VALIDATION_ERROR('请在前端将图片转换为WebP格式后上传')
    }

    try {
      // 生成安全的文件名
      const { generateSafeFileName } = await import('../../utils/file-validation.js')
      const fileName = generateSafeFileName(file.name || 'voucher', '.webp')
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

      const url = `/api/v2/vouchers/${key}`
      return { url, key }
    } catch (error: any) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw Errors.INTERNAL_ERROR(`上传失败: ${error.message}`)
    }
  }) as any
)

// 下载凭证
flowsRoutes.get('/vouchers/*', async c => {
  if (!getUserPosition(c)) {
    throw Errors.FORBIDDEN()
  }

  const requestPath = c.req.path
  // 只处理 /api/v2/vouchers/ 路径
  const fullPath = requestPath.replace(/^\/api\/v2\/vouchers\//, '')

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
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw Errors.INTERNAL_ERROR(`下载失败: ${error.message}`)
  }
})

// 创建现金流水
const createCashFlowRoute = createRoute({
  method: 'post',
  path: '/flows',
  summary: 'Create cash flow',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCashFlowSchema,
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
            data: z.object({
              id: z.string(),
              voucherNo: z.string(),
            }),
          }),
        },
      },
      description: 'Created cash flow ID and voucher number',
    },
  },
})

flowsRoutes.openapi(
  createCashFlowRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.FINANCE, 'flow', PermissionAction.CREATE)) {
      throw Errors.FORBIDDEN()
    }
    const body = c.req.valid('json')

    // projectId 的逻辑：从 siteId 或直接传入的 projectId 获取
    let projectId = body.projectId ?? null

    if (!projectId && body.siteId) {
      // 从 siteId 查找 projectId
      const r = await (c.env.DB.prepare('select projectId from sites where id=?')
        .bind(body.siteId)
        .first() as Promise<{ projectId: string } | null>)
      if (r?.projectId) { projectId = r.projectId }
    }

    // projectId 现在是可选的，财务流水可以不关联部门

    const result = await c.var.services.finance.createCashFlow({
      accountId: body.accountId,
      categoryId: body.categoryId,
      bizDate: body.bizDate,
      type: body.type,
      amountCents: body.amountCents,
      voucherUrls: body.voucherUrls ?? (body.voucherUrl ? [body.voucherUrl] : undefined),
      voucherNo: body.voucherNo,
      method: body.method,
      siteId: body.siteId,
      projectId: projectId,
      counterparty: body.counterparty,
      memo: body.memo,
      createdBy: c.get('employeeId'),
    })

    logAuditAction(
      c,
      'create',
      'cash_flow',
      result.id,
      JSON.stringify({ voucherNo: result.voucherNo, type: body.type, amountCents: body.amountCents })
    )
    return { id: result.id, voucherNo: result.voucherNo }
  }) as any
)

// 更新凭证
const updateVoucherRoute = createRoute({
  method: 'put',
  path: '/flows/{id}/voucher',
  summary: 'Update cash flow voucher',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateVoucherSchema,
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
            data: z.object({
              ok: z.boolean(),
            }),
          }),
        },
      },
      description: 'Success',
    },
  },
})

flowsRoutes.openapi(
  updateVoucherRoute,
  createRouteHandler(async (c: any) => {
    if (!hasPermission(c, PermissionModule.FINANCE, 'flow', PermissionAction.UPDATE)) {
      throw Errors.FORBIDDEN()
    }
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    let voucherUrls: string[] = []
    if (body.voucherUrls && Array.isArray(body.voucherUrls)) {
      voucherUrls = body.voucherUrls.filter((url: string) => url && url.trim())
    } else if (body.voucherUrl) {
      voucherUrls = [body.voucherUrl]
    }
    if (voucherUrls.length === 0) {
      throw Errors.VALIDATION_ERROR('voucherUrls参数必填')
    }

    await c.var.services.finance.updateCashFlowVoucher(id, voucherUrls)

    logAuditAction(
      c,
      'update',
      'cash_flow',
      id,
      JSON.stringify({ voucherUrls: voucherUrls, action: 'update_voucher' })
    )
    return { ok: true }
  }) as any
)

// 红冲流水
const reverseFlowRoute = createRoute({
  method: 'post',
  path: '/flows/{id}/reverse',
  summary: 'Reverse a cash flow (红冲)',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            reversalReason: z.string().min(1, '冲正原因不能为空'),
          }),
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
            data: z.object({
              ok: z.boolean(),
              reversalId: z.string(),
              reversalVoucherNo: z.string(),
              originalVoucherNo: z.string(),
            }),
          }),
        },
      },
      description: 'Reversal result',
    },
  },
})

flowsRoutes.openapi(
  reverseFlowRoute,
  createRouteHandler(async (c: any) => {
    // 权限检查 - 仅财务主管和会计可冲正
    if (!hasPermission(c, PermissionModule.FINANCE, 'flow', PermissionAction.REVERSE)) {
      throw Errors.FORBIDDEN('无权进行流水冲正操作')
    }

    const { id } = c.req.valid('param')
    const { reversalReason } = c.req.valid('json')

    const result = await c.var.services.finance.reverseFlow(id, {
      reversalReason,
      createdBy: c.get('employeeId'),
    })

    // 审计日志 - 记录敏感操作
    logAuditAction(
      c,
      'reverse',
      'cash_flow',
      id,
      JSON.stringify({
        reversalId: result.reversalId,
        reversalVoucherNo: result.reversalVoucherNo,
        reason: reversalReason,
        originalVoucherNo: result.originalVoucherNo,
      })
    )

    return result
  }) as any
)
