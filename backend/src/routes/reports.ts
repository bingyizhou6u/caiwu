import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, canRead, canViewReports } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid, getUserDepartmentId } from '../utils/db.js'
import { getOrCreateDefaultHQ, ensureDefaultCurrencies } from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { parseCsv } from '../utils/csv.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../utils/validator.js'
import { createDepartmentSchema, createSiteSchema, updateDepartmentSchema, updateSiteSchema } from '../schemas/master-data.schema.js'
import { createCurrencySchema, updateCurrencySchema, createCategorySchema, updateCategorySchema, createCashFlowSchema, createArApDocSchema, createSettlementSchema, confirmArApDocSchema } from '../schemas/business.schema.js'
import { dateQuerySchema, idQuerySchema, docIdQuerySchema, dateRangeQuerySchema, singleDateQuerySchema, arApSummaryQuerySchema, arApDetailQuerySchema, salaryReportQuerySchema, uuidSchema } from '../schemas/common.schema.js'
import { z } from 'zod'
import { dashboardRoutes } from './reports/dashboard.js'
import { cashFlowReportsRoutes } from './reports/cash-flow.js'
import { arApReportsRoutes } from './reports/ar-ap.js'
import { expenseReportsRoutes } from './reports/expense.js'
import { accountReportsRoutes } from './reports/account.js'
import { salaryReportsRoutes } from './reports/salary.js'

export const reportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 挂载子模块路由
reportsRoutes.route('/dashboard', dashboardRoutes)
reportsRoutes.route('/reports', cashFlowReportsRoutes)
reportsRoutes.route('/reports', arApReportsRoutes)
reportsRoutes.route('/reports', expenseReportsRoutes)
reportsRoutes.route('/reports', accountReportsRoutes)
reportsRoutes.route('/reports', salaryReportsRoutes)

// 其他工具端点（保留在reports.ts中）
// TODO: 这些端点应该迁移到相应的模块中

// Health check
reportsRoutes.get('/health', async (c) => {
  const r = await c.env.DB.prepare('select 1 as ok').first<{ ok: number }>()
  return c.json({ db: r?.ok === 1 })
})

reportsRoutes.get('/version', (c) => c.json({ version: 'currencies-v1' }))

// Next voucher number for a given date (JZYYYYMMDD-XXX)
reportsRoutes.get('/flows/next-voucher', validateQuery(dateQuerySchema), async (c) => {
  const query = getValidatedQuery<z.infer<typeof dateQuerySchema>>(c)
  const date = query.date
  const day = date.replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  return c.json({ voucher_no: `JZ${day}-${seq}` })
})

// Initialize minimal master data if empty (idempotent)
reportsRoutes.post('/init-if-empty', async (c) => {
  const hq = await c.env.DB.prepare('select count(1) as n from headquarters').first<{ n: number }>()
  const created: Record<string, string> = {}
  if (!hq || hq.n === 0) {
    const hqId = uuid()
    await c.env.DB.prepare('insert into headquarters(id,name,active) values(?,?,1)')
      .bind(hqId, '总部').run()
    created.hqId = hqId

    // 不创建默认项目和默认站点，账务如果没有明确指定项目则归属总部（department_id=null）

    const accId = uuid()
    await c.env.DB.prepare('insert into accounts(id,name,type,currency,opening_cents,active) values(?,?,?,?,0,1)')
      .bind(accId, '现金', 'cash', 'CNY').run()
    created.accountId = accId

    const catIn = uuid()
    await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,NULL)')
      .bind(catIn, '收入-其他', 'income').run()
    created.categoryIncomeId = catIn

    const catOut = uuid()
    await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,NULL)')
      .bind(catOut, '支出-其他', 'expense').run()
    created.categoryExpenseId = catOut
  }
  // 已移除默认admin创建逻辑
  // 系统初始化后，必须通过员工管理创建第一个管理员账号
  await ensureDefaultCurrencies(c.env.DB)
  return c.json({ created })
})

// 已移除bootstrap-admin端点
// 系统初始化后，必须通过员工管理创建第一个管理员账号

// Minimal CRUD for headquarters/departments/sites (for scaffolding)
reportsRoutes.get('/hq', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from headquarters').all()
  return c.json(rows.results ?? [])
})

// HQ creation disabled per product decision (single default HQ)
reportsRoutes.post('/hq', async (c) => {
  throw Errors.BUSINESS_ERROR('总部配置已禁用')
})

reportsRoutes.get('/departments', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from departments').all()
  return c.json(rows.results ?? [])
})

reportsRoutes.post('/departments', validateJson(createDepartmentSchema), async (c) => {
  try {
    if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
    const body = getValidatedData<z.infer<typeof createDepartmentSchema>>(c)
    const hq = body.hq_id ? { id: body.hq_id } : await getOrCreateDefaultHQ(c.env.DB)
    // 检查项目名称是否全局唯一
    const existed = await c.env.DB.prepare('select id from departments where name=?').bind(body.name).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('项目名称')
    const id = uuid()
    await c.env.DB.prepare('insert into departments(id,hq_id,name,active) values(?,?,?,1)')
      .bind(id, hq.id, body.name).run()
    
    // 确保userId存在后再记录审计日志
    const userId = c.get('userId') as string | undefined
    if (userId) {
      await logAudit(c.env.DB, userId, 'create', 'department', id, JSON.stringify({ name: body.name, hq_id: hq.id }))
    }
    
    return c.json({ id, hq_id: hq.id, name: body.name })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    throw Errors.INTERNAL_ERROR(String(e?.message || e))
  }
})

reportsRoutes.get('/sites', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from sites').all()
  return c.json(rows.results ?? [])
})

reportsRoutes.post('/sites', validateJson(createSiteSchema), async (c) => {
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
reportsRoutes.put('/hq/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const hq = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update headquarters set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'headquarters', id, JSON.stringify(body))
  return c.json({ ok: true })
})

reportsRoutes.delete('/hq/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const dept = await c.env.DB.prepare('select name from headquarters where id=?').bind(id).first<{ name: string }>()
  await c.env.DB.prepare('update headquarters set active=0 where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'headquarters', id, JSON.stringify({ name: dept?.name }))
  return c.json({ ok: true })
})

reportsRoutes.put('/departments/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, hq_id?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) {
    // 检查名称是否与其他项目重复
    const existed = await c.env.DB.prepare('select id from departments where name=? and id!=?').bind(body.name, id).first<{ id: string }>()
    if (existed?.id) throw Errors.DUPLICATE('项目名称')
    updates.push('name=?'); binds.push(body.name)
  }
  if (body.hq_id !== undefined) { updates.push('hq_id=?'); binds.push(body.hq_id) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update departments set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'update', 'department', id, JSON.stringify(body))
  }
  
  return c.json({ ok: true })
})

reportsRoutes.delete('/departments/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const dept = await c.env.DB.prepare('select name from departments where id=?').bind(id).first<{ name: string }>()
  if (!dept) throw Errors.NOT_FOUND('项目')
  // 检查是否有站点使用此项目（包括所有站点，不只是active的）
  const sites = await c.env.DB.prepare('select count(1) as cnt from sites where department_id=?').bind(id).first<{ cnt: number }>()
  if (sites && Number(sites.cnt) > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')
  }
  await c.env.DB.prepare('delete from departments where id=?').bind(id).run()
  
  // 确保userId存在后再记录审计日志
  const userId = c.get('userId') as string | undefined
  if (userId) {
    await logAudit(c.env.DB, userId, 'delete', 'department', id, JSON.stringify({ name: dept.name }))
  }
  
  return c.json({ ok: true })
})

reportsRoutes.put('/sites/:id', async (c) => {
  if (!(await requireRole(c, ['finance','auditor']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, department_id?: string, active?: number }>()
  const updates = []
  const binds = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.department_id !== undefined) { updates.push('department_id=?'); binds.push(body.department_id) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active) }
  if (updates.length === 0) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  binds.push(id)
  await c.env.DB.prepare(`update sites set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'site', id, JSON.stringify(body))
  return c.json({ ok: true })
})

reportsRoutes.delete('/sites/:id', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const site = await c.env.DB.prepare('select name from sites where id=?').bind(id).first<{ name: string }>()
  if (!site) throw Errors.NOT_FOUND('站点')
  await c.env.DB.prepare('delete from sites where id=?').bind(id).run()
  logAuditAction(c, 'delete', 'site', id, JSON.stringify({ name: site.name }))
  return c.json({ ok: true })
})

// Accounts
reportsRoutes.get('/accounts', async (c) => {
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
reportsRoutes.get('/accounts/:id/transactions', async (c) => {
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
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

reportsRoutes.post('/accounts', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = await c.req.json<{ name: string, type: string, currency?: string, alias?: string, account_number?: string, opening_cents?: number }>()
  const id = uuid()
  const currency = (body.currency ?? 'CNY').trim().toUpperCase()
  const cur = await c.env.DB.prepare('select code from currencies where code=? and active=1').bind(currency).first<{ code: string }>()
  if (!cur?.code) throw Errors.NOT_FOUND(`币种 ${currency}`)
  await c.env.DB.prepare('insert into accounts(id,name,type,currency,alias,account_number,opening_cents,active) values(?,?,?,?,?,?,?,1)')
    .bind(id, body.name, body.type, currency, body.alias ?? null, body.account_number ?? null, body.opening_cents ?? 0).run()
  logAuditAction(c, 'create', 'account', id, JSON.stringify({ name: body.name, type: body.type, currency }))
  return c.json({ id, ...body, currency })
})

reportsRoutes.put('/accounts/:id', async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string, type?: string, currency?: string, alias?: string, account_number?: string, active?: number }>()
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

reportsRoutes.delete('/accounts/:id', async (c) => {
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

reportsRoutes.get('/currencies', async (c) => {
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

reportsRoutes.post('/currencies', validateJson(createCurrencySchema), async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createCurrencySchema>>(c)
  const code = body.code
  
  // 检查币种代码是否已存在
  const existed = await c.env.DB.prepare('select code from currencies where code=?').bind(code).first<{ code: string }>()
  if (existed?.code) throw Errors.DUPLICATE('币种代码')
  
  await c.env.DB.prepare('insert into currencies(code,name,active) values(?,?,1)').bind(code, body.name).run()
  logAuditAction(c, 'create', 'currency', code, JSON.stringify({ name: body.name }))
  return c.json({ code, name: body.name })
})

reportsRoutes.put('/currencies/:code', validateJson(updateCurrencySchema), async (c) => {
  if (!(await requireRole(c, ['manager','finance']))) throw Errors.FORBIDDEN()
  const code = c.req.param('code').toUpperCase()
  const body = getValidatedData<z.infer<typeof updateCurrencySchema>>(c)
  
  const updates: string[] = []
  const binds: any[] = []
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.active !== undefined) { updates.push('active=?'); binds.push(body.active ? 1 : 0) }
  
  binds.push(code)
  await c.env.DB.prepare(`update currencies set ${updates.join(',')} where code=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'currency', code, JSON.stringify(body))
  return c.json({ ok: true })
})

reportsRoutes.delete('/currencies/:code', async (c) => {
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
reportsRoutes.get('/categories', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare('select * from categories order by kind,name').all()
  return c.json(rows.results ?? [])
})

reportsRoutes.post('/categories', validateJson(createCategorySchema), async (c) => {
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
reportsRoutes.put('/categories/:id', validateJson(updateCategorySchema), async (c) => {
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
    updates.push('kind=?'); binds.push(body.kind)
  }
  
  binds.push(id)
  await c.env.DB.prepare(`update categories set ${updates.join(',')} where id=?`).bind(...binds).run()
  logAuditAction(c, 'update', 'category', id, JSON.stringify(body))
  return c.json({ ok: true })
})

reportsRoutes.delete('/categories/:id', async (c) => {
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
reportsRoutes.get('/flows', async (c) => {
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
  return c.json(rows.results ?? [])
})

// 文件上传：凭证上传
reportsRoutes.post('/upload/voucher', async (c) => {
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
reportsRoutes.get('/vouchers/*', async (c) => {
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
      // 返回更详细的错误信息用于调试
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

// 计算账户当前余额（账变前金额）
async function getAccountBalanceBefore(db: D1Database, accountId: string, transactionDate: string, transactionTime: number): Promise<number> {
  // 期初余额
  const ob = await db.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
    .bind(accountId).first<{ ob: number }>()
  
  // 计算账变前的所有交易
  // 需要考虑同一天的情况：只计算在此交易时间之前的交易
  const pre = await db.prepare(`
    select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
    from cash_flows 
    where account_id=? 
    and (biz_date < ? or (biz_date = ? and created_at < ?))
  `).bind(accountId, transactionDate, transactionDate, transactionTime).first<{ s: number }>()
  
  return (ob?.ob ?? 0) + (pre?.s ?? 0)
}

reportsRoutes.post('/flows', validateJson(createCashFlowSchema), async (c) => {
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

// ================= AR/AP =================
function todayStr() { const d = new Date(); const y=d.getFullYear(); const m=('0'+(d.getMonth()+1)).slice(-2); const dd=('0'+d.getDate()).slice(-2); return `${y}-${m}-${dd}` }
async function nextDocNo(db: D1Database, kind: 'AR'|'AP', date: string) {
  const count = await db.prepare('select count(1) as n from ar_ap_docs where kind=? and issue_date=?').bind(kind, date).first<{ n:number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3,'0')
  const day = date.replace(/-/g,'')
  return `${kind}${day}-${seq}`
}

reportsRoutes.get('/ar/docs', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const kind = c.req.query('kind') // AR|AP optional
  const status = c.req.query('status') // optional
  let sql = 'select d.*, coalesce(s.sum_settle,0) as settled_cents, st.name as site_name from ar_ap_docs d left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id left join sites st on st.id=d.site_id'
  const conds: string[] = []
  const binds: any[] = []
  if (kind) { conds.push('d.kind=?'); binds.push(kind) }
  if (status) { conds.push('d.status=?'); binds.push(status) }
  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by d.issue_date desc'
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json(rows.results ?? [])
})

reportsRoutes.post('/ar/docs', validateJson(createArApDocSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createArApDocSchema>>(c)
  const id = uuid()
  const issue = body.issue_date ?? todayStr()
  const amount = body.amount_cents
  const docNo = body.doc_no ?? await nextDocNo(c.env.DB, body.kind, issue)
  await c.env.DB.prepare(`
    insert into ar_ap_docs(id,kind,doc_no,party_id,site_id,department_id,issue_date,due_date,amount_cents,status,memo)
    values(?,?,?,?,?,?,?,?,?,'open',?)
  `).bind(id, body.kind, docNo, body.party_id ?? null, body.site_id ?? null, body.department_id ?? null, issue, body.due_date ?? null, amount, body.memo ?? null).run()
  logAuditAction(c, 'create', 'ar_ap_doc', id, JSON.stringify({ kind: body.kind, doc_no: docNo, amount_cents: amount }))
  return c.json({ id, doc_no: docNo })
})

reportsRoutes.get('/ar/settlements', validateQuery(docIdQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const docId = query.doc_id
  const rows = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(docId).all()
  return c.json(rows.results ?? [])
})

async function refreshDocStatus(db: D1Database, docId: string) {
  const doc = await db.prepare('select amount_cents from ar_ap_docs where id=?').bind(docId).first<{ amount_cents:number }>()
  if (!doc) return
  const s = await db.prepare('select coalesce(sum(settle_amount_cents),0) as s from settlements where doc_id=?').bind(docId).first<{ s:number }>()
  const total = s?.s ?? 0
  const status = total <= 0 ? 'open' : (total < (doc.amount_cents ?? 0) ? 'partially_settled' : 'settled')
  await db.prepare('update ar_ap_docs set status=? where id=?').bind(status, docId).run()
}

reportsRoutes.post('/ar/settlements', validateJson(createSettlementSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createSettlementSchema>>(c)
  const id = uuid()
  const amount = body.settle_amount_cents
  await c.env.DB.prepare('insert into settlements(id,doc_id,flow_id,settle_amount_cents,settle_date) values(?,?,?,?,?)')
    .bind(id, body.doc_id, body.flow_id, amount, body.settle_date ?? todayStr()).run()
  await refreshDocStatus(c.env.DB, body.doc_id)
  logAuditAction(c, 'settle', 'ar_ap_doc', body.doc_id, JSON.stringify({ settlement_id: id, amount_cents: amount }))
  return c.json({ id })
})

// Statement
reportsRoutes.get('/ar/statement', validateQuery(docIdQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof docIdQuerySchema>>(c)
  const docId = query.doc_id
  
  const doc = await c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(docId).first<any>()
  const settlements = await c.env.DB.prepare('select * from settlements where doc_id=? order by settle_date asc').bind(docId).all<any>()
  const settled = (settlements.results ?? []).reduce((a:number,b:any)=>a+(b.settle_amount_cents||0),0)
  const remaining = (doc?.amount_cents ?? 0) - settled
  return c.json({ doc, settlements: settlements.results ?? [], settled_cents: settled, remaining_cents: remaining })
})

// 确认AR/AP文档，生成对应的收入/支出记录
reportsRoutes.post('/ar/confirm', validateJson(confirmArApDocSchema), async (c) => {
  if (!(await requireRole(c, ['finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof confirmArApDocSchema>>(c)
  const docId = body.doc_id
  
  // 获取文档信息
  const doc = await c.env.DB.prepare('select * from ar_ap_docs where id=?').bind(docId).first<any>()
  if (!doc) throw Errors.NOT_FOUND('单据')
  if (doc.status === 'confirmed') throw Errors.BUSINESS_ERROR('单据已确认')
  
  // 验证账户存在且币种匹配
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
  
  // 确定交易类型：AR -> income, AP -> expense
  const transactionType = doc.kind === 'AR' ? 'income' : 'expense'
  
  const flowId = uuid()
  const now = Date.now()
  const amount = doc.amount_cents
  
  // 生成凭证号
  const day = String(body.biz_date).replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(body.biz_date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`
  
  // 计算账变前金额
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, body.biz_date, now)
  
  // 计算账变金额（收入为正，支出为负）
  const delta = transactionType === 'income' ? amount : -amount
  const balanceAfter = balanceBefore + delta
  
  // 插入cash_flow记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    flowId, voucherNo, body.biz_date, transactionType, body.account_id, body.category_id,
    body.method ?? null, amount, doc.site_id ?? null, doc.department_id ?? null,
    doc.party_id ?? null, body.memo ?? doc.memo ?? null, body.voucher_url,
    body.created_by ?? c.get('userId') ?? 'system', now
  ).run()
  
  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, flowId, body.biz_date, transactionType, amount,
    balanceBefore, balanceAfter, now
  ).run()
  
  // 更新文档状态为confirmed
  await c.env.DB.prepare('update ar_ap_docs set status=? where id=?').bind('confirmed', docId).run()
  
  // 创建settlement记录（确认时全额核销）
  const settlementId = uuid()
  await c.env.DB.prepare('insert into settlements(id,doc_id,flow_id,settle_amount_cents,settle_date) values(?,?,?,?,?)')
    .bind(settlementId, docId, flowId, amount, body.biz_date).run()
  
  await refreshDocStatus(c.env.DB, docId)
  
  logAuditAction(c, 'confirm', 'ar_ap_doc', docId, JSON.stringify({ 
    kind: doc.kind, flow_id: flowId, transaction_type: transactionType, amount_cents: amount 
  }))
  
  return c.json({ ok: true, flow_id: flowId, voucher_no: voucherNo })
})

// ================= Reports V1 =================
// Department cash summary

reportsRoutes.get('/reports/department-cash', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  let sql = `
    select d.id as department_id, d.name as department_name,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents
    from departments d
    left join cash_flows f on f.department_id=d.id and f.biz_date>=? and f.biz_date<=?
  `
  let binds: any[] = [start, end]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' where d.id=?'
      binds.push(deptId)
    }
  }
  
  sql += ' group by d.id, d.name order by d.name'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  const mapped = (rows.results ?? []).map((r:any)=>({ ...r, net_cents: (r.income_cents||0) - (r.expense_cents||0) }))
  return c.json({ rows: mapped })
})

// Site cash summary + growth vs previous equal-length period

reportsRoutes.get('/reports/site-growth', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  const startDate = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime())/86400000)+1)
  const prevEnd = new Date(startDate.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (days-1)*86400000)
  const prevStartStr = prevStart.toISOString().slice(0,10)
  const prevEndStr = prevEnd.toISOString().slice(0,10)

  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let curSql = `
    select s.id as site_id, s.name as site_name,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
  `
  let curBinds: any[] = [start, end]
  
  let prevSql = `
    select s.id as site_id,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
  `
  let prevBinds: any[] = [prevStartStr, prevEndStr]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      curSql += ' where s.department_id=?'
      curBinds.push(deptId)
      prevSql += ' where s.department_id=?'
      prevBinds.push(deptId)
    }
  }
  
  curSql += ' group by s.id, s.name'
  prevSql += ' group by s.id'
  
  const cur = await c.env.DB.prepare(curSql).bind(...curBinds).all<any>()
  const prev = await c.env.DB.prepare(prevSql).bind(...prevBinds).all<any>()
  
  const prevMap = new Map((prev.results ?? []).map((r:any)=>[r.site_id, r.income_cents||0]))
  const rows = (cur.results ?? []).map((r:any)=>{
    const net = (r.income_cents||0) - (r.expense_cents||0)
    const prevIncome = prevMap.get(r.site_id) || 0
    const growth_rate = prevIncome === 0 ? (r.income_cents>0? 1 : 0) : (r.income_cents - prevIncome)/prevIncome
    return { ...r, net_cents: net, prev_income_cents: prevIncome, growth_rate }
  })
  return c.json({ rows, prev_range: { start: prevStartStr, end: prevEndStr } })
})

// AR/AP summary by status and totals for period

reportsRoutes.get('/reports/ar-summary', validateQuery(arApSummaryQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof arApSummaryQuerySchema>>(c)
  const kind = query.kind
  const start = query.start
  const end = query.end
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    where d.kind=? and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [kind, start, end]
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0, settled = 0
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status]||0) + (r.amount_cents||0)
  }
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AR detail - 应收账款明细

reportsRoutes.get('/reports/ar-detail', validateQuery(arApDetailQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  try {
    const query = getValidatedQuery<z.infer<typeof arApDetailQuerySchema>>(c)
    const start = query.start
    const end = query.end
    let sql = `
      select d.*, coalesce(s.sum_settle,0) as settled_cents,
        (d.amount_cents - coalesce(s.sum_settle,0)) as remaining_cents
      from ar_ap_docs d
      left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
      where d.kind='AR'
    `
    let binds: any[] = []
    if (start && end) {
      sql += ' and d.issue_date>=? and d.issue_date<=?'
      binds.push(start, end)
    }
    sql += ' order by d.issue_date desc, d.doc_no desc'
    
    // 应用数据权限过滤
    const scoped = await applyDataScope(c, sql, binds)
    const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
    return c.json({ rows: docs.results ?? [] })
  } catch (err: any) {
    console.error('AR detail error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// AP summary - 应付账款汇总

reportsRoutes.get('/reports/ap-summary', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  let sql = `
    select d.*, coalesce(s.sum_settle,0) as settled_cents
    from ar_ap_docs d
    left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
    where d.kind='AP' and d.issue_date>=? and d.issue_date<=?
  `
  let binds: any[] = [start, end]
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
  
  const rows = docs.results ?? []
  const byStatus: Record<string, number> = {}
  let total = 0, settled = 0
  for (const r of rows) {
    total += r.amount_cents || 0
    settled += r.settled_cents || 0
    byStatus[r.status] = (byStatus[r.status]||0) + (r.amount_cents||0)
  }
  return c.json({ total_cents: total, settled_cents: settled, by_status: byStatus, rows })
})

// AP detail - 应付账款明细

reportsRoutes.get('/reports/ap-detail', validateQuery(arApDetailQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  try {
    const query = getValidatedQuery<z.infer<typeof arApDetailQuerySchema>>(c)
    const start = query.start
    const end = query.end
    let sql = `
      select d.*, coalesce(s.sum_settle,0) as settled_cents,
        (d.amount_cents - coalesce(s.sum_settle,0)) as remaining_cents
      from ar_ap_docs d
      left join (select doc_id, sum(settle_amount_cents) as sum_settle from settlements group by doc_id) s on s.doc_id=d.id
      where d.kind='AP'
    `
    let binds: any[] = []
    if (start && end) {
      sql += ' and d.issue_date>=? and d.issue_date<=?'
      binds.push(start, end)
    }
    sql += ' order by d.issue_date desc, d.doc_no desc'
    
    // 应用数据权限过滤
    const scoped = await applyDataScope(c, sql, binds)
    const docs = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
    return c.json({ rows: docs.results ?? [] })
  } catch (err: any) {
    console.error('AP detail error:', err)
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw Errors.INTERNAL_ERROR(err.message || '查询失败')
  }
})

// Daily expense summary by category - 日常支出汇总

reportsRoutes.get('/reports/expense-summary', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select c.id as category_id, c.name as category_name,
      coalesce(sum(f.amount_cents),0) as total_cents,
      count(*) as count
    from categories c
    left join cash_flows f on f.category_id=c.id and f.type='expense' and f.biz_date>=? and f.biz_date<=?
    where c.kind='expense'
  `
  let binds: any[] = [start, end]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and (f.department_id=? or f.department_id is null)'
      binds.push(deptId)
    }
  }
  
  sql += ' group by c.id, c.name having count(*) > 0 order by total_cents desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  let total = 0
  for (const r of rows.results ?? []) {
    total += r.total_cents || 0
  }
  return c.json({ total_cents: total, rows: rows.results ?? [] })
})

// Daily expense detail by category - 日常支出明细

const expenseDetailQuerySchema = dateRangeQuerySchema.extend({
  category_id: uuidSchema.optional(),
})
reportsRoutes.get('/reports/expense-detail', validateQuery(expenseDetailQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof expenseDetailQuerySchema>>(c)
  const start = query.start
  const end = query.end
  const categoryId = query.category_id
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select f.id, f.voucher_no, f.biz_date, f.amount_cents, f.counterparty, f.memo,
      c.name as category_name, a.name as account_name,
      d.name as department_name, s.name as site_name
    from cash_flows f
    left join categories c on c.id=f.category_id
    left join accounts a on a.id=f.account_id
    left join departments d on d.id=f.department_id
    left join sites s on s.id=f.site_id
    where f.type='expense' and f.biz_date>=? and f.biz_date<=?
  `
  let binds: any[] = [start, end]
  
  if (categoryId) {
    sql += ' and f.category_id=?'
    binds.push(categoryId)
  }
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and (f.department_id=? or f.department_id is null)'
      binds.push(deptId)
    }
  }
  
  sql += ' order by f.biz_date desc, f.created_at desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  return c.json({ rows: rows.results ?? [] })
})

// Site revenue - 站点收费（站点的收入统计）
// Account balance summary - 账号余额汇总

reportsRoutes.get('/reports/account-balance', validateQuery(singleDateQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof singleDateQuerySchema>>(c)
  const asOf = query.as_of
  
  // 获取所有活跃账户
  const accounts = await c.env.DB.prepare('select id, name, type, currency, account_number from accounts where active=1 order by name').all<any>()
  
  const rows = []
  for (const acc of (accounts.results || [])) {
    // 期初余额：opening_balances + 截至asOf之前的交易
    const ob = await c.env.DB.prepare('select coalesce(sum(case when type="account" and ref_id=? then amount_cents else 0 end),0) as ob from opening_balances')
      .bind(acc.id).first<{ ob: number }>()
    
    const pre = await c.env.DB.prepare(`
      select coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end),0) as s
      from cash_flows where account_id=? and biz_date<?
    `).bind(acc.id, asOf).first<{ s: number }>()
    
    const opening = (ob?.ob ?? 0) + (pre?.s ?? 0)
    
    // 截至asOf当天的交易
    const period = await c.env.DB.prepare(`
      select 
        coalesce(sum(case when type='income' then amount_cents else 0 end),0) as income_cents,
        coalesce(sum(case when type='expense' then amount_cents else 0 end),0) as expense_cents
      from cash_flows where account_id=? and biz_date=?
    `).bind(acc.id, asOf).first<{ income_cents: number, expense_cents: number }>()
    
    const closing = opening + (period?.income_cents ?? 0) - (period?.expense_cents ?? 0)
    
    rows.push({
      account_id: acc.id,
      account_name: acc.name,
      account_type: acc.type,
      account_number: acc.account_number,
      currency: acc.currency,
      opening_cents: opening,
      income_cents: period?.income_cents ?? 0,
      expense_cents: period?.expense_cents ?? 0,
      closing_cents: closing
    })
  }
  
  return c.json({ rows, as_of: asOf })
})

// 借款报表 - 按个人汇总
// 员工薪资表 - 按月份统计每个员工的薪资

reportsRoutes.get('/reports/employee-salary', validateQuery(salaryReportQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof salaryReportQuerySchema>>(c)
  const year = query.year?.toString() || new Date().getFullYear().toString()
  const month = query.month?.toString()
  
  // 查询所有活跃员工
  const employees = await c.env.DB.prepare(`
    select 
      e.id,
      e.name,
      e.department_id,
      d.name as department_name,
      e.join_date,
      e.probation_salary_cents,
      e.regular_salary_cents,
      e.status,
      e.regular_date
    from employees e
    left join departments d on e.department_id = d.id
    where e.active = 1
    order by d.name, e.name
  `).all<any>()
  
  const rows = []
  const yearNum = parseInt(year)
  const monthNum = month ? parseInt(month) : null
  
  for (const emp of (employees.results || [])) {
    const joinDate = new Date(emp.join_date + 'T00:00:00Z')
    const joinYear = joinDate.getFullYear()
    const joinMonth = joinDate.getMonth() + 1
    
    // 如果指定了月份，只计算该月
    if (monthNum) {
      // 检查员工在该月是否在职
      if (joinYear > yearNum || (joinYear === yearNum && joinMonth > monthNum)) {
        continue // 还未入职
      }
      
      // 计算该月应发工资
      let salaryCents = 0
      let workDays = 0
      
      if (emp.status === 'regular' && emp.regular_date) {
        // 已转正，检查转正日期
        const regularDate = new Date(emp.regular_date + 'T00:00:00Z')
        const regularYear = regularDate.getFullYear()
        const regularMonth = regularDate.getMonth() + 1
        
        if (regularYear < yearNum || (regularYear === yearNum && regularMonth < monthNum)) {
          // 转正日期早于该月，使用转正工资
          salaryCents = emp.regular_salary_cents
        } else if (regularYear === yearNum && regularMonth === monthNum) {
          // 该月转正，需要按比例计算
          const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
          const regularDay = regularDate.getDate()
          const probationDays = regularDay - 1
          const regularDays = daysInMonth - regularDay + 1
          salaryCents = Math.round(
            (emp.probation_salary_cents * probationDays + emp.regular_salary_cents * regularDays) / daysInMonth
          )
        } else {
          // 还未转正，使用试用期工资
          salaryCents = emp.probation_salary_cents
        }
      } else {
        // 未转正，使用试用期工资
        salaryCents = emp.probation_salary_cents
      }
      
      // 计算该月实际工作天数
      const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
      if (joinYear === yearNum && joinMonth === monthNum) {
        // 该月入职
        workDays = daysInMonth - joinDate.getDate() + 1
      } else {
        workDays = daysInMonth
      }
      
      // 查询该员工在该月的请假记录（仅已批准的）
      const monthStart = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
      const monthEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const leaves = await c.env.DB.prepare(`
        select leave_type, start_date, end_date, days
        from employee_leaves
        where employee_id = ? 
          and status = 'approved'
          and start_date <= ?
          and end_date >= ?
      `).bind(emp.id, monthEnd, monthStart).all<any>()
      
      // 计算需要扣除的请假天数（非年假）
      let leaveDaysToDeduct = 0
      for (const leave of (leaves.results || [])) {
        if (leave.leave_type !== 'annual') {
          // 非年假需要扣除，需要计算在该月的实际天数
          const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
          const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
          const monthStartDate = new Date(monthStart + 'T00:00:00Z')
          const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
          
          // 计算请假记录与当前月份的交集
          const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
          const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
          
          if (overlapStart <= overlapEnd) {
            const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            leaveDaysToDeduct += overlapDays
          }
        }
      }
      
      // 从工作天数中扣除非年假的请假天数
      workDays = Math.max(0, workDays - leaveDaysToDeduct)
      
      // 计算应发工资（按实际工作天数）
      const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)
      
      rows.push({
        employee_id: emp.id,
        employee_name: emp.name,
        department_id: emp.department_id,
        department_name: emp.department_name,
        year: yearNum,
        month: monthNum,
        join_date: emp.join_date,
        status: emp.status,
        regular_date: emp.regular_date,
        base_salary_cents: salaryCents,
        work_days: workDays,
        days_in_month: daysInMonth,
        leave_days: leaveDaysToDeduct,
        actual_salary_cents: actualSalaryCents,
      })
    } else {
      // 未指定月份，计算全年12个月
      for (let m = 1; m <= 12; m++) {
        // 检查员工在该月是否在职
        if (joinYear > yearNum || (joinYear === yearNum && joinMonth > m)) {
          continue // 还未入职
        }
        
        // 计算该月应发工资
        let salaryCents = 0
        let workDays = 0
        
        if (emp.status === 'regular' && emp.regular_date) {
          const regularDate = new Date(emp.regular_date + 'T00:00:00Z')
          const regularYear = regularDate.getFullYear()
          const regularMonth = regularDate.getMonth() + 1
          
          if (regularYear < yearNum || (regularYear === yearNum && regularMonth < m)) {
            salaryCents = emp.regular_salary_cents
          } else if (regularYear === yearNum && regularMonth === m) {
            const daysInMonth = new Date(yearNum, m, 0).getDate()
            const regularDay = regularDate.getDate()
            const probationDays = regularDay - 1
            const regularDays = daysInMonth - regularDay + 1
            salaryCents = Math.round(
              (emp.probation_salary_cents * probationDays + emp.regular_salary_cents * regularDays) / daysInMonth
            )
          } else {
            salaryCents = emp.probation_salary_cents
          }
        } else {
          salaryCents = emp.probation_salary_cents
        }
        
        const daysInMonth = new Date(yearNum, m, 0).getDate()
        if (joinYear === yearNum && joinMonth === m) {
          workDays = daysInMonth - joinDate.getDate() + 1
        } else {
          workDays = daysInMonth
        }
        
        // 查询该员工在该月的请假记录（仅已批准的）
        const monthStart = `${yearNum}-${String(m).padStart(2, '0')}-01`
        const monthEnd = `${yearNum}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
        
        const leaves = await c.env.DB.prepare(`
          select leave_type, start_date, end_date, days
          from employee_leaves
          where employee_id = ? 
            and status = 'approved'
            and start_date <= ?
            and end_date >= ?
        `).bind(emp.id, monthEnd, monthStart).all<any>()
        
        // 计算需要扣除的请假天数（非年假）
        let leaveDaysToDeduct = 0
        for (const leave of (leaves.results || [])) {
          if (leave.leave_type !== 'annual') {
            // 非年假需要扣除，需要计算在该月的实际天数
            const leaveStart = new Date(leave.start_date + 'T00:00:00Z')
            const leaveEnd = new Date(leave.end_date + 'T00:00:00Z')
            const monthStartDate = new Date(monthStart + 'T00:00:00Z')
            const monthEndDate = new Date(monthEnd + 'T00:00:00Z')
            
            // 计算请假记录与当前月份的交集
            const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
            const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
            
            if (overlapStart <= overlapEnd) {
              const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              leaveDaysToDeduct += overlapDays
            }
          }
        }
        
        // 从工作天数中扣除非年假的请假天数
        workDays = Math.max(0, workDays - leaveDaysToDeduct)
        
        const actualSalaryCents = Math.round((salaryCents * workDays) / daysInMonth)
        
        rows.push({
          employee_id: emp.id,
          employee_name: emp.name,
          department_id: emp.department_id,
          department_name: emp.department_name,
          year: yearNum,
          month: m,
          join_date: emp.join_date,
          status: emp.status,
          regular_date: emp.regular_date,
          base_salary_cents: salaryCents,
          work_days: workDays,
          days_in_month: daysInMonth,
          leave_days: leaveDaysToDeduct,
          actual_salary_cents: actualSalaryCents,
        })
      }
    }
  }
  
  return c.json({ results: rows })
})


reportsRoutes.get('/reports/borrowing-summary', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  // 查询每个人的借款汇总（按币种分组）
  const sql = `
    select 
      u.id as user_id, 
      u.name as borrower_name, 
      u.email as borrower_email,
      b.currency,
      coalesce(sum(b.amount_cents), 0) as total_borrowed_cents,
      coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.user_id = b.user_id and b2.currency = b.currency
        )
      ), 0) as total_repaid_cents,
      (coalesce(sum(b.amount_cents), 0) - coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id in (
          select id from borrowings b2 
          where b2.user_id = b.user_id and b2.currency = b.currency
        )
      ), 0)) as balance_cents
    from users u
    inner join borrowings b on b.user_id = u.id
    where u.active = 1
    group by u.id, u.name, u.email, b.currency
    having balance_cents != 0
    order by u.name, b.currency
  `
  
  const rows = await c.env.DB.prepare(sql).all()
  return c.json(rows.results ?? [])
})

// 借款报表 - 个人明细（借款和还款记录）

const userIdParamSchema = z.object({
  user_id: uuidSchema,
})
reportsRoutes.get('/reports/borrowing-detail/:user_id', validateParam(userIdParamSchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const params = getValidatedParams<z.infer<typeof userIdParamSchema>>(c)
  const userId = params.user_id
  
  // 验证用户存在
  const user = await c.env.DB.prepare('select * from users where id=?').bind(userId).first<any>()
  if (!user) throw Errors.NOT_FOUND('用户')
  
  // 获取借款记录
  const borrowings = await c.env.DB.prepare(`
    select b.*, 
      a.name as account_name, a.currency as account_currency,
      u.name as creator_name
    from borrowings b
    left join accounts a on a.id=b.account_id
    left join users u on u.id=b.created_by
    where b.user_id=?
    order by b.borrow_date desc, b.created_at desc
  `).bind(userId).all()
  
  // 获取还款记录（通过借款记录关联）
  const repayments = await c.env.DB.prepare(`
    select r.*, 
      b.user_id, b.borrow_date,
      a.name as account_name, a.currency as account_currency,
      u.name as creator_name
    from repayments r
    left join borrowings b on b.id=r.borrowing_id
    left join accounts a on a.id=r.account_id
    left join users u on u.id=r.created_by
    where b.user_id=?
    order by r.repay_date desc, r.created_at desc
  `).bind(userId).all()
  
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    borrowings: borrowings.results || [],
    repayments: repayments.results || [],
  })
})


// 新站点收入报表
const newSiteRevenueQuerySchema = dateRangeQuerySchema.extend({
  days: z.coerce.number().int().positive().optional(),
})
reportsRoutes.get('/reports/new-site-revenue', validateQuery(newSiteRevenueQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  const query = getValidatedQuery<z.infer<typeof newSiteRevenueQuerySchema>>(c)
  const start = query.start
  const end = query.end
  const days = query.days ?? 30
  
  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined
  
  let sql = `
    select s.id as site_id, s.name as site_name, s.created_at as site_created_at,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents,
      count(distinct case when f.type='income' then f.id end) as income_count
    from sites s
    left join cash_flows f on f.site_id=s.id and f.biz_date>=? and f.biz_date<=?
    where julianday(?) - julianday(datetime(s.created_at/1000, 'unixepoch')) <= ?
    and s.created_at is not null
  `
  let binds: any[] = [start, end, end, days]
  
  // 应用数据权限过滤
  if (role !== 'manager' && role !== 'finance' && userId) {
    const deptId = await getUserDepartmentId(c.env.DB, userId)
    if (deptId) {
      sql += ' and s.department_id=?'
      binds.push(deptId)
    }
  }
  
  sql += ' group by s.id, s.name, s.created_at order by s.created_at desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  const mapped = (rows.results ?? []).map((r:any)=>({ 
    ...r, 
    net_cents: (r.income_cents||0) - (r.expense_cents||0) 
  }))
  return c.json({ rows: mapped })
})

// ================= CSV Import =================

