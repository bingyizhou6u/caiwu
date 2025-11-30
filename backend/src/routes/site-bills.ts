import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { isHQDirector, isHQFinance, isProjectDirector, isProjectFinance, getDataAccessFilter, getUserEmployee } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../utils/validator.js'
import { createSiteBillSchema, updateSiteBillSchema } from '../schemas/business.schema.js'
import { siteBillQuerySchema, idParamSchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const siteBillsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 站点账单管理 - 列表
siteBillsRoutes.get('/site-bills', validateQuery(siteBillQuerySchema), async (c) => {
  // 所有人都可以查看（通过数据权限过滤）
  const query = getValidatedQuery<z.infer<typeof siteBillQuerySchema>>(c)
  const siteId = query.site_id
  const startDate = query.start_date
  const endDate = query.end_date
  const billType = query.bill_type
  const status = query.status
  
  let sql = `
    select 
      sb.*,
      s.name as site_name,
      s.site_code,
      a.name as account_name,
      c.name as category_name,
      cur.name as currency_name,
      u.name as creator_name
    from site_bills sb
    left join sites s on s.id = sb.site_id
    left join accounts a on a.id = sb.account_id
    left join categories c on c.id = sb.category_id
    left join currencies cur on cur.code = sb.currency
    left join users u on u.id = sb.created_by
    where 1=1
  `
  const binds: any[] = []
  
  if (siteId) {
    sql += ' and sb.site_id = ?'
    binds.push(siteId)
  }
  
  if (startDate) {
    sql += ' and sb.bill_date >= ?'
    binds.push(startDate)
  }
  
  if (endDate) {
    sql += ' and sb.bill_date <= ?'
    binds.push(endDate)
  }
  
  if (billType) {
    sql += ' and sb.bill_type = ?'
    binds.push(billType)
  }
  
  if (status) {
    sql += ' and sb.status = ?'
    binds.push(status)
  }
  
  sql += ' order by sb.bill_date desc, sb.created_at desc'
  
  // 应用数据权限过滤
  const scopeFilter = getDataAccessFilter(c, 'sb')
  if (scopeFilter.where !== '1=1') {
    sql += ` AND ${scopeFilter.where}`
    binds.push(...scopeFilter.binds)
  }
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 站点账单管理 - 创建
siteBillsRoutes.post('/site-bills', validateJson(createSiteBillSchema), async (c) => {
  const canCreate = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canCreate) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createSiteBillSchema>>(c)
  
  // 验证站点存在
  const site = await c.env.DB.prepare('select id from sites where id=?').bind(body.site_id).first<{ id: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')
  
  // 验证币种存在
  const currency = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(body.currency).first<{ code: string }>()
  if (!currency) throw Errors.NOT_FOUND('币种')
  
  // 验证账户（如果提供）
  if (body.account_id) {
    const account = await c.env.DB.prepare('select id from accounts where id=?').bind(body.account_id).first<{ id: string }>()
    if (!account) throw Errors.NOT_FOUND('账户')
  }
  
  // 验证类别（如果提供）
  if (body.category_id) {
    const category = await c.env.DB.prepare('select id from categories where id=?').bind(body.category_id).first<{ id: string }>()
    if (!category) throw Errors.NOT_FOUND('类别')
  }
  
  const id = uuid()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  const status = body.status || 'pending'
  
  await c.env.DB.prepare(`
    insert into site_bills(
      id, site_id, bill_date, bill_type, amount_cents, currency,
      description, account_id, category_id, status, payment_date, memo,
      created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.site_id,
    body.bill_date,
    body.bill_type,
    body.amount_cents,
    body.currency,
    body.description || null,
    body.account_id || null,
    body.category_id || null,
    status,
    body.payment_date || null,
    body.memo || null,
    userId || null,
    now,
    now
  ).run()
  
  logAuditAction(c, 'create', 'site_bill', id, JSON.stringify({
    site_id: body.site_id,
    bill_date: body.bill_date,
    bill_type: body.bill_type,
    amount_cents: body.amount_cents,
    currency: body.currency
  }))
  
  const created = await c.env.DB.prepare(`
    select 
      sb.*,
      s.name as site_name,
      s.site_code,
      a.name as account_name,
      c.name as category_name,
      cur.name as currency_name,
      u.name as creator_name
    from site_bills sb
    left join sites s on s.id = sb.site_id
    left join accounts a on a.id = sb.account_id
    left join categories c on c.id = sb.category_id
    left join currencies cur on cur.code = sb.currency
    left join users u on u.id = sb.created_by
    where sb.id=?
  `).bind(id).first()
  
  return c.json(created)
})

// 站点账单管理 - 更新
siteBillsRoutes.put('/site-bills/:id', validateParam(idParamSchema), validateJson(updateSiteBillSchema), async (c) => {
  const canUpdate = isHQDirector(c) || isHQFinance(c) || isProjectDirector(c) || isProjectFinance(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof updateSiteBillSchema>>(c)
  
  const record = await c.env.DB.prepare('select * from site_bills where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  const updates: string[] = []
  const binds: any[] = []
  
  if (body.bill_date !== undefined) { updates.push('bill_date=?'); binds.push(body.bill_date) }
  if (body.bill_type !== undefined) {
    updates.push('bill_type=?'); binds.push(body.bill_type)
  }
  if (body.amount_cents !== undefined) { updates.push('amount_cents=?'); binds.push(body.amount_cents) }
  if (body.currency !== undefined) {
    // 验证币种存在
    const currency = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(body.currency).first<{ code: string }>()
    if (!currency) throw Errors.NOT_FOUND('币种')
    updates.push('currency=?'); binds.push(body.currency)
  }
  if (body.description !== undefined) { updates.push('description=?'); binds.push(body.description || null) }
  if (body.account_id !== undefined) {
    if (body.account_id) {
      const account = await c.env.DB.prepare('select id from accounts where id=?').bind(body.account_id).first<{ id: string }>()
      if (!account) throw Errors.NOT_FOUND('账户')
    }
    updates.push('account_id=?'); binds.push(body.account_id || null)
  }
  if (body.category_id !== undefined) {
    if (body.category_id) {
      const category = await c.env.DB.prepare('select id from categories where id=?').bind(body.category_id).first<{ id: string }>()
      if (!category) throw Errors.NOT_FOUND('类别')
    }
    updates.push('category_id=?'); binds.push(body.category_id || null)
  }
  if (body.status !== undefined) { updates.push('status=?'); binds.push(body.status) }
  if (body.payment_date !== undefined) { updates.push('payment_date=?'); binds.push(body.payment_date || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }
  
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  
  updates.push('updated_at=?')
  binds.push(Date.now())
  binds.push(id)
  
  await c.env.DB.prepare(`update site_bills set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  logAuditAction(c, 'update', 'site_bill', id, JSON.stringify(body))
  
  const updated = await c.env.DB.prepare(`
    select 
      sb.*,
      s.name as site_name,
      s.site_code,
      a.name as account_name,
      c.name as category_name,
      cur.name as currency_name,
      u.name as creator_name
    from site_bills sb
    left join sites s on s.id = sb.site_id
    left join accounts a on a.id = sb.account_id
    left join categories c on c.id = sb.category_id
    left join currencies cur on cur.code = sb.currency
    left join users u on u.id = sb.created_by
    where sb.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 站点账单管理 - 删除
siteBillsRoutes.delete('/site-bills/:id', validateParam(idParamSchema), async (c) => {
  const canDelete = isHQDirector(c) || isHQFinance(c)
  if (!canDelete) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  
  const record = await c.env.DB.prepare('select * from site_bills where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  await c.env.DB.prepare('delete from site_bills where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'site_bill', id, JSON.stringify({
    site_id: record.site_id,
    bill_date: record.bill_date
  }))
  
  return c.json({ ok: true })
})

// 站点账单管理 - 获取详情
siteBillsRoutes.get('/site-bills/:id', validateParam(idParamSchema), async (c) => {
  // 所有人都可以查看
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  
  const record = await c.env.DB.prepare(`
    select 
      sb.*,
      s.name as site_name,
      s.site_code,
      a.name as account_name,
      c.name as category_name,
      cur.name as currency_name,
      u.name as creator_name
    from site_bills sb
    left join sites s on s.id = sb.site_id
    left join accounts a on a.id = sb.account_id
    left join categories c on c.id = sb.category_id
    left join currencies cur on cur.code = sb.currency
    left join users u on u.id = sb.created_by
    where sb.id=?
  `).bind(id).first()
  
  if (!record) throw Errors.NOT_FOUND()
  
  return c.json(record)
})

