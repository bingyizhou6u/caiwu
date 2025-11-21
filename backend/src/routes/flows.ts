import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, canRead } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { FinanceService } from '../services/FinanceService.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { createCashFlowSchema } from '../schemas/business.schema.js'
import { dateQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'
import type { R2Bucket } from '@cloudflare/workers-types'

export const flowsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

flowsRoutes.get('/flows/next-voucher', validateQuery(dateQuerySchema), async (c) => {
  const query = getValidatedQuery<z.infer<typeof dateQuerySchema>>(c)
  const date = query.date
  const day = date.replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  return c.json({ voucher_no: `JZ${day}-${seq}` })
})

// Simple cash flow create/list

flowsRoutes.get('/flows', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  let sql = `
    select f.*, a.name as account_name, coalesce(c.name,'') as category_name
    from cash_flows f
    left join accounts a on a.id=f.account_id
    left join categories c on c.id=f.category_id
  `
  let binds: any[] = []
  const scoped = await applyDataScope(c, sql, binds)
  sql = scoped.sql + ' order by f.biz_date desc, f.created_at desc limit 200'
  binds = scoped.binds
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()

  // 处理voucher_url字段：如果是JSON数组，解析为数组；否则保持原样（向后兼容）
  const results = (rows.results ?? []).map((row: any) => {
    if (row.voucher_url) {
      try {
        const parsed = JSON.parse(row.voucher_url)
        if (Array.isArray(parsed)) {
          row.voucher_urls = parsed
          // 保留voucher_url字段以便向后兼容（取第一个URL）
          row.voucher_url = parsed[0] || null
        }
      } catch (e) {
        // 如果不是JSON格式，保持原样（向后兼容）
        row.voucher_urls = [row.voucher_url]
      }
    } else {
      row.voucher_urls = []
    }
    return row
  })

  return c.json({ results })
})

// 文件上传：凭证上传

flowsRoutes.post('/upload/voucher', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()

  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) throw Errors.VALIDATION_ERROR('文件必填')

  // 限制文件大小（10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) throw Errors.VALIDATION_ERROR('文件过大（最大10MB）')

  // 限制文件类型：只允许图片格式
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw Errors.VALIDATION_ERROR('只允许上传图片格式（JPEG、PNG、GIF、WebP）')
  }

  // 后端只接收WebP格式（前端已转换）
  // 如果不是WebP格式，返回错误
  if (file.type !== 'image/webp') {
    throw Errors.VALIDATION_ERROR('请在前端将图片转换为WebP格式后上传')
  }

  try {
    // 生成唯一文件名：时间戳-随机字符串.webp
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${random}.webp`
    const key = `vouchers/${fileName}`

    // 上传到R2（已经是WebP格式）
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

    // 返回文件URL（使用相对路径，通过Pages Functions代理）
    const url = `/api/vouchers/${key}`
    return c.json({ url, key })
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(`上传失败: ${error.message}`)
  }
})

// 文件下载：凭证访问 - 使用通配符路由

flowsRoutes.get('/vouchers/*', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()

  // 获取完整路径（去掉 /api/vouchers/ 前缀）
  const requestPath = c.req.path
  const fullPath = requestPath.replace('/api/vouchers/', '')

  // 如果路径为空或格式不正确，返回错误
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
    headers.set('Content-Type', 'image/webp') // 统一返回WebP格式
    headers.set('Cache-Control', 'public, max-age=31536000')

    return new Response(object.body as any, { headers })
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw Errors.INTERNAL_ERROR(`下载失败: ${error.message}`)
  }
})

flowsRoutes.post('/flows', validateJson(createCashFlowSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCashFlowSchema>>(c)
  const id = uuid()
  const now = Date.now()
  const amount = body.amount_cents

  // 支持单个URL或URL数组，转换为JSON字符串存储
  let voucherUrls: string[] = []
  if (body.voucher_urls && Array.isArray(body.voucher_urls)) {
    voucherUrls = body.voucher_urls.filter((url: string) => url && url.trim())
  } else if (body.voucher_url) {
    // 向后兼容：单个URL也支持
    voucherUrls = [body.voucher_url]
  }
  const voucherUrlJson = JSON.stringify(voucherUrls)

  // 归属规则：owner_scope=hq => department_id=null；owner_scope=department => 需提供 department_id 或 site_id
  let ownerScope = body.owner_scope as ('hq' | 'department' | undefined)
  let departmentId = body.department_id ?? null
  if (!departmentId && body.site_id) {
    const r = await c.env.DB.prepare('select department_id from sites where id=?').bind(body.site_id).first<{ department_id: string }>()
    if (r?.department_id) departmentId = r.department_id
  }
  if (ownerScope === 'hq') {
    departmentId = null
  } else if (ownerScope === 'department') {
    if (!departmentId) throw Errors.VALIDATION_ERROR('department所有者需要提供department_id或site_id')
  } else {
    // 未显式声明时：若仍无departmentId则视为hq
    if (!departmentId) ownerScope = 'hq'
  }

  const method = body.method ?? null
  let voucherNo = body.voucher_no ?? null
  if (!voucherNo && body.biz_date) {
    const day = String(body.biz_date).replace(/-/g, '')
    const count = await c.env.DB
      .prepare('select count(1) as n from cash_flows where biz_date=?')
      .bind(body.biz_date).first<{ n: number }>()
    const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
    voucherNo = `JZ${day}-${seq}`
  }

  // 计算账变前金额
  const balanceBefore = await new FinanceService(c.env.DB).getAccountBalanceBefore(body.account_id, body.biz_date, now)

  // 计算账变金额（收入为正，支出为负）
  const delta = body.type === 'income' ? amount : (body.type === 'expense' ? -amount : 0)
  const balanceAfter = balanceBefore + delta

  // 插入流水记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, voucherNo, body.biz_date, body.type, body.account_id, body.category_id, method,
    amount, body.site_id ?? null, departmentId, body.counterparty ?? null, body.memo ?? null,
    voucherUrlJson, body.created_by ?? 'system', now
  ).run()

  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, id, body.biz_date, body.type, amount,
    balanceBefore, balanceAfter, now
  ).run()

  logAuditAction(c, 'create', 'cash_flow', id, JSON.stringify({ voucher_no: voucherNo, type: body.type, amount_cents: amount }))
  return c.json({ id })
})

// 更新记账记录的凭证
flowsRoutes.put('/flows/:id/voucher', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ voucher_urls?: string[], voucher_url?: string }>()

  // 支持单个URL或URL数组，转换为JSON字符串存储
  let voucherUrls: string[] = []
  if (body.voucher_urls && Array.isArray(body.voucher_urls)) {
    voucherUrls = body.voucher_urls.filter((url: string) => url && url.trim())
  } else if (body.voucher_url) {
    // 向后兼容：单个URL也支持
    voucherUrls = [body.voucher_url]
  }
  if (voucherUrls.length === 0) throw Errors.VALIDATION_ERROR('voucher_urls参数必填')

  const voucherUrlJson = JSON.stringify(voucherUrls)

  // 检查记录是否存在
  const flow = await c.env.DB.prepare('select id, voucher_no from cash_flows where id=?').bind(id).first<{ id: string, voucher_no: string }>()
  if (!flow) throw Errors.NOT_FOUND('流水记录')

  // 更新凭证URL
  await c.env.DB.prepare('update cash_flows set voucher_url=? where id=?').bind(voucherUrlJson, id).run()

  logAuditAction(c, 'update', 'cash_flow', id, JSON.stringify({ voucher_urls: voucherUrls, action: 'update_voucher' }))
  return c.json({ ok: true })
})
