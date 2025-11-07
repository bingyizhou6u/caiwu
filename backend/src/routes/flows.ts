import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, canRead } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { getAccountBalanceBefore } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../utils/validator.js'
import { createCashFlowSchema, createAccountSchema, updateAccountSchema, createCurrencySchema, createCategorySchema, updateCategorySchema } from '../schemas/business.schema.js'
import { createSiteSchema, updateSiteSchema } from '../schemas/master-data.schema.js'
import { dateQuerySchema, idParamSchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

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


flowsRoutes.get('/sites', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from sites').all()
  return c.json(rows.results ?? [])
})

flowsRoutes.post('/sites', validateJson(createSiteSchema), async (c) => {
  try {
    if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createSiteSchema>>(c)
    // 同一项目下站点重名校验
    const existed = await c.env.DB.prepare('select id from sites where department_id=? and name=? and active=1')
      .bind(body.department_id, body.name).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('站点名称')
    const id = uuid()
    await c.env.DB.prepare('insert into sites(id,department_id,name,active) values(?,?,?,1)')
      .bind(id, body.department_id, body.name).run()
    logAuditAction(c, 'create', 'site', id, JSON.stringify({ name: body.name, department_id: body.department_id }))
    return c.json({ id, ...body })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

// Update and delete operations
flowsRoutes.put('/hq/:id', validateParam(idParamSchema), async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = await c.req.json<{ name?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const hq = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  if (!hq) throw Errors.NOT_FOUND('总部')
  binds.push(id)
  await c.env.DB.prepare(`update headquarters set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'headquarters', id, JSON.stringify(body))
  return c.json({ ok: true })
})

flowsRoutes.delete('/hq/:id', validateParam(idParamSchema), async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const dept = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('总部')
  await c.env.DB.prepare('update headquarters set active=0 where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'headquarters', id, JSON.stringify({ name: dept.name }))
  return c.json({ ok: true })
})

flowsRoutes.put('/departments/:id', validateParam(idParamSchema), async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = await c.req.json<{ name?: string, hq_id?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) {
    // 检查名称是否与其他项目重复
    const existed = await c.env.DB.prepare('select id from departments where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('部门名称')
    updates.push('name=?'); binds.push(body.name)
  }
  if (body.hq_id !== undefined) { updates.push('hq_id=?'); binds.push(body.hq_id) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('部门')
  binds.push(id)
  await c.env.DB.prepare(`update departments set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'update', 'department', id, JSON.stringify(body))
  }
  
  return c.json({ ok: true })
})

flowsRoutes.delete('/departments/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('部门')
  // 检查是否有站点使用此项目（包括所有站点，不只是active的）
  const sites = await c.env.DB.prepare('select count(1) as cnt from sites where department_id=?').bind(id).first<{ cnt: number }>()
  if (sites && Number(sites.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该部门下还有站点')
  }
  await c.env.DB.prepare('delete from departments where id=?').bind(id).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'delete', 'department', id, JSON.stringify({ name: dept.name }))
  }
  
  return c.json({ ok: true })
})

flowsRoutes.put('/sites/:id', validateJson(updateSiteSchema), async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateSiteSchema>>(c)
  const updates = []
  const binds = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.department_id !== undefined) { updates.push('department_id=?'); binds.push(body.department_id) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')
  binds.push(id)
  await c.env.DB.prepare(`update sites set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'site', id, JSON.stringify(body))
  return c.json({ ok: true })
})

flowsRoutes.delete('/sites/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')
  await c.env.DB.prepare('delete from sites where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'site', id, JSON.stringify({ name: site.name }))
  return c.json({ ok: true })
})

// Accounts
flowsRoutes.get('/accounts', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const search = c.req.query('search')
  if (search) {
    const like = `%${search.toLowerCase()}%`
    const rows = await c.env.DB.prepare(`
      select a.*, c.name as currency_name
      from accounts a left join currencies c on c.code = a.currency
      where lower(a.name) like ? or lower(ifnull(a.alias,'')) like ? or lower(ifnull(a.account_number,'')) like ?
      order by a.name
    `).bind(like, like, like).all()
    return c.json(rows.results ?? [])
  }
  const rows = await c.env.DB.prepare('select a.*, c.name as currency_name from accounts a left join currencies c on c.code = a.currency order by a.name').all()
  return c.json(rows.results ?? [])
})

// 账户明细查询：查询指定账户的所有账变记录（必须在 /api/accounts/:id 之前定义）
flowsRoutes.get('/accounts/:id/transactions', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  try {
    const accountId = c.req.param('id')
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')
    
    const rows = await c.env.DB.prepare(`
      select 
        t.id, t.transaction_date, t.transaction_type, t.amount_cents,
        t.balance_before_cents, t.balance_after_cents, t.created_at,
        f.voucher_no, f.memo, f.counterparty, f.voucher_url,
        c.name as category_name
      from account_transactions t
      left join cash_flows f on f.id = t.flow_id
      left join categories c on c.id = f.category_id
      where t.account_id = ?
      order by t.transaction_date desc, t.created_at desc
      limit ? offset ?
    `).bind(accountId, limit, offset).all<any>()
    
    return c.json({ results: rows.results ?? [] })
  } catch (err: any) {
    console.error('Account transactions error:', err)
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

flowsRoutes.post('/accounts', validateJson(createAccountSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createAccountSchema>>(c)
  const id = uuid()
  const currency = (body.currency ?? 'CNY').trim().toUpperCase()
  const cur = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(currency).first<{ code: string }>()
  if (!cur?.code) throw Errors.NOT_FOUND(`币种 ${currency}`)
  await c.env.DB.prepare('insert into accounts(id,name,type,currency,alias,account_number,opening_cents,active) values(?,?,?,?,?,?,?,1)')
    .bind(id, body.name, body.type, currency, body.alias ?? null, body.account_number ?? null, body.opening_cents ?? 0).run()
  logAuditAction(c, 'create', 'account', id, JSON.stringify({ name: body.name, type: body.type, currency }))
  return c.json({ id, ...body, currency })
})

flowsRoutes.put('/accounts/:id', validateJson(updateAccountSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateAccountSchema>>(c)
  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.type !== undefined) { updates.push('type=?'); binds.push(body.type) }
  if (body.currency !== undefined) {
    const code = body.currency.trim().toUpperCase()
    const cur = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(code).first<{ code: string }>()
    if (!cur?.code) throw Errors.NOT_FOUND(`币种 ${code}`)
    updates.push('currency=?'); binds.push(code)
  }
  if (body.alias !== undefined) { updates.push('alias=?'); binds.push(body.alias) }
  if (body.account_number !== undefined) { updates.push('account_number=?'); binds.push(body.account_number) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  binds.push(id)
  await c.env.DB.prepare(`update accounts set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'account', id, JSON.stringify(body))
  return c.json({ ok: true })
})

flowsRoutes.delete('/accounts/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const account = await c.env.DB.prepare('select name from accounts where id=?').bind(id).first<{ name: string }>()
  if (!account) throw Errors.NOT_FOUND('账户')
  // 检查是否有流水使用此账户
  const flows = await c.env.DB.prepare('select count(1) as cnt from cash_flows where account_id=?').bind(id).first<{ cnt: number }>()
  if (flows && Number(flows.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该账户还有流水记录')
  }
  await c.env.DB.prepare('delete from accounts where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'account', id, JSON.stringify({ name: account.name }))
  return c.json({ ok: true })
})

flowsRoutes.get('/currencies', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const search = c.req.query('search')
  if (search) {
    const like = `%${search.toUpperCase()}%`
    const rows = await c.env.DB.prepare('select * from currencies where upper(code) like ? or upper(name) like ? order by code')
      .bind(like, like).all()
    return c.json(rows.results ?? [])
  }
  const rows = await c.env.DB.prepare('select * from currencies order by code').all()
  return c.json(rows.results ?? [])
})

flowsRoutes.post('/currencies', validateJson(createCurrencySchema), async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCurrencySchema>>(c)
  const code = body.code.trim().toUpperCase()
  // 检查币种代码是否已存在
  const existed = await c.env.DB.prepare('select code from currencies where code=?').bind(code).first<{ code: string }>()
  if (existed?.code) throw Errors.DUPLICATE('币种代码')
  await c.env.DB.prepare('insert into currencies(code,name,active) values(?,?,1)').bind(code, body.name).run()
  logAuditAction(c, 'create', 'currency', code, JSON.stringify({ name: body.name }))
  return c.json({ code, name: body.name })
})

flowsRoutes.put('/currencies/:code', async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
  const code = c.req.param('code').toUpperCase()
  const body = await c.req.json<{ name?: string, active?: number }>()
  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active ? 1 : 0) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  binds.push(code)
  await c.env.DB.prepare(`update currencies set ${updates.join(',')} where code=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'currency', code, JSON.stringify(body))
  return c.json({ ok: true })
})

flowsRoutes.delete('/currencies/:code', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const code = c.req.param('code').toUpperCase()
  const currency = await c.env.DB.prepare('select name from currencies where code=?').bind(code).first<{ name: string }>()
  if (!currency) throw Errors.NOT_FOUND('币种')
  // 检查是否有账户使用此币种（包括所有账户，不只是active的）
  const accounts = await c.env.DB.prepare('select count(1) as cnt from accounts where currency=?').bind(code).first<{ cnt: number }>()
  if (accounts && Number(accounts.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该币种还有账户使用')
  }
  await c.env.DB.prepare('delete from currencies where code=?').bind(code).run()
  logAuditAction(c, 'delete', 'currency', code, JSON.stringify({ name: currency.name }))
  return c.json({ ok: true })
})

// Categories
flowsRoutes.get('/categories', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from categories order by kind,name').all()
  return c.json(rows.results ?? [])
})

flowsRoutes.post('/categories', validateJson(createCategorySchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCategorySchema>>(c)
  // 检查类别名称是否已存在
  const existed = await c.env.DB.prepare('select id from categories where name=?').bind(body.name).first<{ id: string }>()
  if (existed?.id) throw Errors.DUPLICATE('类别名称')
  const id = uuid()
  await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,?)')
    .bind(id, body.name, body.kind, body.parent_id ?? null).run()
  logAuditAction(c, 'create', 'category', id, JSON.stringify({ name: body.name, kind: body.kind }))
  return c.json({ id, ...body })
})

// Update category (no delete allowed). Only name/kind allowed, and kind restricted to income|expense
flowsRoutes.put('/categories/:id', validateJson(updateCategorySchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateCategorySchema>>(c)
  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) {
    // 检查名称是否与其他类别重复
    const existed = await c.env.DB.prepare('select id from categories where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('类别名称')
    updates.push('name=?'); binds.push(body.name)
  }
  if (body.kind !== undefined) {
    if (!['income','expense'].includes(body.kind)) throw Errors.VALIDATION_ERROR('kind必须为income或expense')
    updates.push('kind=?'); binds.push(body.kind)
  }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  binds.push(id)
  await c.env.DB.prepare(`update categories set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'category', id, JSON.stringify(body))
  return c.json({ ok: true })
})

flowsRoutes.delete('/categories/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const category = await c.env.DB.prepare('select name from categories where id=?').bind(id).first<{ name: string }>()
  if (!category) throw Errors.NOT_FOUND('类别')
  // 检查是否有流水使用此类别
  const flows = await c.env.DB.prepare('select count(1) as cnt from cash_flows where category_id=?').bind(id).first<{ cnt: number }>()
  if (flows && Number(flows.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')
  }
  await c.env.DB.prepare('delete from categories where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'category', id, JSON.stringify({ name: category.name }))
  return c.json({ ok: true })
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
    const bucket = c.env.VOUCHERS as R2Bucket
    await bucket.put(key, file, {
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
    const bucket = c.env.VOUCHERS as R2Bucket
    const object = await bucket.get(fullPath)
    if (!object) {
      throw Errors.NOT_FOUND('凭证文件')
    }
    
    const headers = new Headers()
    headers.set('Content-Type', 'image/webp') // 统一返回WebP格式
    headers.set('Cache-Control', 'public, max-age=31536000')
    
    return new Response(object.body, { headers })
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
  let ownerScope = body.owner_scope as ('hq'|'department'|undefined)
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
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, body.biz_date, now)
  
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

// ================= AR/AP =================
function todayStr() { const d = new Date(); const y=d.getFullYear(); const m=('0'+(d.getMonth()+1)).slice(-2); const dd=('0'+d.getDate()).slice(-2); return `${y}-${m}-${dd}` }
async function nextDocNo(db: D1Database, kind: 'AR'|'AP', date: string) {
  const count = await db.prepare('select count(1) as n from ar_ap_docs where kind=? and issue_date=?').bind(kind, date).first<{ n:number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3,'0')
  const day = date.replace(/-/g,'')
  return `${kind}${day}-${seq}`
}

