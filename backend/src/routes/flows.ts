import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import type { Env, AppVariables } from '../types.js'
import { hasPermission, getUserPosition, getUserEmployee, getDataAccessFilter } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { Errors } from '../utils/errors.js'
import { createCashFlowSchema } from '../schemas/business.schema.js'
import { dateQuerySchema } from '../schemas/common.schema.js'
import type { R2Bucket } from '@cloudflare/workers-types'

export const flowsRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Schema 定义
const cashFlowResponseSchema = z.object({
  id: z.string(),
  voucherNo: z.string().nullable(),
  bizDate: z.string(),
  type: z.enum(['income', 'expense']),
  accountId: z.string(),
  categoryId: z.string().nullable(),
  method: z.string().nullable(),
  amountCents: z.number(),
  siteId: z.string().nullable(),
  departmentId: z.string().nullable(),
  counterparty: z.string().nullable(),
  memo: z.string().nullable(),
  voucherUrls: z.array(z.string()),
  voucherUrl: z.string().nullable(), // Backward compatibility
  createdBy: z.string().nullable(),
  createdAt: z.number().nullable(),
  accountName: z.string().nullable(),
  categoryName: z.string().nullable()
})

const listCashFlowsResponseSchema = z.object({
  results: z.array(cashFlowResponseSchema)
})

const nextVoucherResponseSchema = z.object({
  voucherNo: z.string()
})

const uploadVoucherResponseSchema = z.object({
  url: z.string(),
  key: z.string()
})

const updateVoucherSchema = z.object({
  voucherUrls: z.array(z.string()).optional(),
  voucherUrl: z.string().optional()
})

// 路由

// 获取下一个凭证号
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
    return c.json({ voucherNo: voucherNo })
  }
)

// 获取现金流水列表
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

    // 注意：目前 service 仅实现了基础列表。
    // 原始路由中的复杂过滤逻辑 (getDataAccessFilter) 需要保留或移至 service。
    // 目前，我们暂时保留这里的复杂查询逻辑，或稍后移至 service。
    // 既然任务是使用 FinanceService，我可能应该增强 FinanceService 以支持这一点，
    // 但原始代码使用了带有动态 where 子句的原始 SQL。
    // 为了坚持使用 FinanceService 的计划，我将使用 service 的 listCashFlows，
    // 但我可能需要传递原始 SQL 或在那里构建它。
    // 但是，我之前写的 service 实现很简单。
    // 让我们使用 service，但也许我需要更新 service 以接受更多过滤器？
    // 或者如果 service 还没准备好进行复杂过滤，我可以暂时保留这里的原始 SQL。
    // 但目标是重构。
    // 让我们暂时保留这里的原始 SQL 方法，以确保过滤没有回退，
    // 因为正确地将动态 SQL 构建移动到 Drizzle/Service 是一个更大的任务。
    // 等等，如果我传递条件，我可以在 service 中使用 Drizzle 的查询构建器。
    // 但是 `getDataAccessFilter` 返回 SQL 字符串和绑定参数。
    // 所以由于列表端点，我将暂时坚持原始实现，
    // 或者我可以将此逻辑移至 service。
    // 让我们将逻辑移至 service？不，`getDataAccessFilter` 是一个返回原始 SQL 部分的实用程序。
    // 既然我写的 `FinanceService.listCashFlows` 太简单，
    // 我将在这里直接调用 `c.env.DB` 以确保列表的正确性。
    // 标记为 TODO 以备将来增强 service。

    // 实际上，如果我更新 service，我可以使用它。但我现在无法在不切换上下文的情况下更新它。
    // 所以我将保留列表端点的原始 SQL，但包装结果处理。

    // 使用 getDataAccessFilter 的自定义过滤逻辑
    // cash_flows 表使用 'created_by' 和 'department_id' 列
    // 它没有 org_department_id，所以我们跳过那一层
    const { where, binds } = getDataAccessFilter(c, 'cash_flows', {
      ownerColumn: 'created_by',
      deptColumn: 'department_id',
      skipOrgDept: true
    })

    let whereClause = sql`1=1`
    if (where !== '1=1') {
      // 从字符串部分和绑定参数重构 SQL
      const parts = where.split('?')
      whereClause = sql``
      parts.forEach((part: string, i: number) => {
        whereClause = whereClause.append(sql.raw(part))
        if (i < binds.length) {
          whereClause = whereClause.append(sql`${binds[i]}`)
        }
      })
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
        voucherNo: f.voucherNo,
        bizDate: f.bizDate,
        type: f.type,
        accountId: f.accountId,
        categoryId: f.categoryId,
        method: f.method,
        amountCents: f.amountCents,
        siteId: f.siteId,
        departmentId: f.departmentId,
        counterparty: f.counterparty,
        memo: f.memo,
        voucherUrl: voucherUrls[0] || null,
        voucherUrls: voucherUrls,
        createdBy: f.createdBy,
        createdAt: f.createdAt,
        accountName: row.accountName,
        categoryName: row.categoryName
      }
    })

    return c.json({ results } as any)
  }
)

// 上传凭证
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

// 下载凭证
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

// 创建现金流水
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
            schema: z.object({ id: z.string(), voucherNo: z.string() })
          }
        },
        description: 'Created cash flow ID and voucher number'
      }
    }
  }),
  async (c) => {
    if (!hasPermission(c, 'finance', 'flow', 'create')) throw Errors.FORBIDDEN()
    const body = c.req.valid('json')

    // ownerScope 和 departmentId 的逻辑
    let ownerScope = body.ownerScope as ('hq' | 'department' | undefined)
    let departmentId = body.departmentId ?? null

    if (!departmentId && body.siteId) {
      // 我们需要从 siteId 查找 departmentId。
      // 由于 FinanceService 没有直接暴露这个 helper，我们可以使用 DB 或添加它。
      // 这里用 DB 直接查找，还是假设 service 处理？
      // service createCashFlow 接受 departmentId。
      // 让我们在这里查找。
      const r = await c.env.DB.prepare('select departmentId from sites where id=?').bind(body.siteId).first<{ departmentId: string }>()
      if (r?.departmentId) departmentId = r.departmentId
    }

    if (ownerScope === 'hq') {
      departmentId = null
    } else if (ownerScope === 'department') {
      if (!departmentId) throw Errors.VALIDATION_ERROR('department所有者需要提供departmentId或siteId')
    } else {
      if (!departmentId) ownerScope = 'hq'
      else ownerScope = 'department'
    }

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
      departmentId: departmentId,
      counterparty: body.counterparty,
      memo: body.memo,
      createdBy: c.get('userId')
    })

    logAuditAction(c, 'create', 'cash_flow', result.id, JSON.stringify({ voucherNo: result.voucherNo, type: body.type, amountCents: body.amountCents }))
    return c.json({ id: result.id, voucherNo: result.voucherNo })
  }
)

// 更新凭证
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
    if (body.voucherUrls && Array.isArray(body.voucherUrls)) {
      voucherUrls = body.voucherUrls.filter((url: string) => url && url.trim())
    } else if (body.voucherUrl) {
      voucherUrls = [body.voucherUrl]
    }
    if (voucherUrls.length === 0) throw Errors.VALIDATION_ERROR('voucherUrls参数必填')

    await c.var.services.finance.updateCashFlowVoucher(id, voucherUrls)

    logAuditAction(c, 'update', 'cash_flow', id, JSON.stringify({ voucherUrls: voucherUrls, action: 'update_voucher' }))
    return c.json({ ok: true })
  }
)
