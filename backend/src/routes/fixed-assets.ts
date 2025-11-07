import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, canRead } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid, getAccountBalanceBefore } from '../utils/db.js'
import { applyDataScope } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../utils/validator.js'
import { createFixedAssetSchema, updateFixedAssetSchema, allocateFixedAssetSchema, createDepreciationSchema, transferFixedAssetSchema, purchaseFixedAssetWithFlowSchema, sellFixedAssetSchema, returnFixedAssetSchema } from '../schemas/business.schema.js'
import { fixedAssetQuerySchema, fixedAssetAllocationQuerySchema, idParamSchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const fixedAssetsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取固定资产列表
fixedAssetsRoutes.get('/fixed-assets', validateQuery(fixedAssetQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof fixedAssetQuerySchema>>(c)
  const search = query.search
  const status = query.status
  const departmentId = query.department_id
  const category = query.category
  
  let sql = `
    select 
      fa.*,
      d.name as department_name,
      s.name as site_name,
      v.name as vendor_name,
      cur.name as currency_name,
      u.name as created_by_name
    from fixed_assets fa
    left join departments d on d.id = fa.department_id
    left join sites s on s.id = fa.site_id
    left join vendors v on v.id = fa.vendor_id
    left join currencies cur on cur.code = fa.currency
    left join users u on u.id = fa.created_by
  `
  const conds: string[] = []
  const binds: any[] = []
  
  if (search) {
    conds.push('(fa.name like ? or fa.asset_code like ? or fa.custodian like ?)')
    const like = `%${search}%`
    binds.push(like, like, like)
  }
  if (status) {
    conds.push('fa.status = ?')
    binds.push(status)
  }
  if (departmentId) {
    conds.push('fa.department_id = ?')
    binds.push(departmentId)
  }
  if (category) {
    conds.push('fa.category = ?')
    binds.push(category)
  }
  
  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by fa.created_at desc'
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 获取资产类别列表（用于筛选）- 必须在 /fixed-assets/:id 之前定义
fixedAssetsRoutes.get('/fixed-assets/categories', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const rows = await c.env.DB.prepare(`
    select distinct category as name
    from fixed_assets
    where category is not null and category != ''
    order by category
  `).all()
  return c.json({ results: rows.results ?? [] })
})

// 获取资产分配记录列表 - 必须在 /fixed-assets/:id 之前定义
fixedAssetsRoutes.get('/fixed-assets/allocations', validateQuery(fixedAssetAllocationQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof fixedAssetAllocationQuerySchema>>(c)
  const assetId = query.asset_id
  const employeeId = query.employee_id
  const returned = query.returned
  
  let sql = `
    select 
      a.*,
      fa.asset_code,
      fa.name as asset_name,
      e.name as employee_name,
      e.department_id as employee_department_id,
      d.name as employee_department_name,
      u.name as created_by_name
    from fixed_asset_allocations a
    left join fixed_assets fa on fa.id = a.asset_id
    left join employees e on e.id = a.employee_id
    left join departments d on d.id = e.department_id
    left join users u on u.id = a.created_by
  `
  const conds: string[] = []
  const binds: any[] = []
  
  if (assetId) {
    conds.push('a.asset_id=?')
    binds.push(assetId)
  }
  if (employeeId) {
    conds.push('a.employee_id=?')
    binds.push(employeeId)
  }
  if (returned === 'true') {
    conds.push('a.return_date is not null')
  } else if (returned === 'false') {
    conds.push('a.return_date is null')
  }
  
  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by a.allocation_date desc, a.created_at desc'
  
  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 获取单个固定资产详情
fixedAssetsRoutes.get('/fixed-assets/:id', validateParam(idParamSchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const asset = await c.env.DB.prepare(`
    select 
      fa.*,
      d.name as department_name,
      s.name as site_name,
      v.name as vendor_name,
      cur.name as currency_name,
      u.name as created_by_name
    from fixed_assets fa
    left join departments d on d.id = fa.department_id
    left join sites s on s.id = fa.site_id
    left join vendors v on v.id = fa.vendor_id
    left join currencies cur on cur.code = fa.currency
    left join users u on u.id = fa.created_by
    where fa.id = ?
  `).bind(id).first()
  
  if (!asset) throw Errors.NOT_FOUND()
  
  // 优化：并行查询折旧记录和变动记录
  const [depreciations, changes] = await Promise.all([
    c.env.DB.prepare(`
      select * from fixed_asset_depreciations
      where asset_id = ?
      order by depreciation_date desc
    `).bind(id).all(),
    c.env.DB.prepare(`
      select 
        fc.*,
        d1.name as from_dept_name,
        d2.name as to_dept_name,
        s1.name as from_site_name,
        s2.name as to_site_name,
        u.name as created_by_name
      from fixed_asset_changes fc
      left join departments d1 on d1.id = fc.from_dept_id
      left join departments d2 on d2.id = fc.to_dept_id
      left join sites s1 on s1.id = fc.from_site_id
      left join sites s2 on s2.id = fc.to_site_id
      left join users u on u.id = fc.created_by
      where fc.asset_id = ?
      order by fc.change_date desc, fc.created_at desc
    `).bind(id).all()
  ])
  
  return c.json({
    ...asset,
    depreciations: depreciations.results ?? [],
    changes: changes.results ?? []
  })
})

// 创建固定资产
fixedAssetsRoutes.post('/fixed-assets', validateJson(createFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产编号是否已存在
  const existed = await c.env.DB.prepare('select id from fixed_assets where asset_code = ?')
    .bind(body.asset_code).first<{ id: string }>()
  if (existed?.id) {
    throw Errors.DUPLICATE('资产代码')
  }
  
  const id = uuid()
  const purchasePrice = body.purchase_price_cents
  const currentValue = body.current_value_cents !== undefined ? body.current_value_cents : purchasePrice
  
  await c.env.DB.prepare(`
    insert into fixed_assets(
      id, asset_code, name, category, purchase_date, purchase_price_cents,
      currency, vendor_id, department_id, site_id, custodian, status,
      depreciation_method, useful_life_years, current_value_cents, memo,
      created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.asset_code,
    body.name,
    body.category || null,
    body.purchase_date || null,
    purchasePrice,
    body.currency,
    body.vendor_id || null,
    body.department_id || null,
    body.site_id || null,
    body.custodian || null,
    body.status || 'in_use',
    body.depreciation_method || null,
    body.useful_life_years || null,
    currentValue,
    body.memo || null,
    userId || null,
    now,
    now
  ).run()
  
  logAuditAction(c, 'create', 'fixed_asset', id, JSON.stringify({
    asset_code: body.asset_code,
    name: body.name,
    purchase_price_cents: purchasePrice
  }))
  
  return c.json({ id, asset_code: body.asset_code })
})

// 更新固定资产
fixedAssetsRoutes.put('/fixed-assets/:id', validateParam(idParamSchema), validateJson(updateFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof updateFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产是否存在
  const existing = await c.env.DB.prepare('select * from fixed_assets where id = ?').bind(id).first()
  if (!existing) throw Errors.NOT_FOUND()
  
  const updates: string[] = []
  const binds: any[] = []
  
  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.category !== undefined) { updates.push('category=?'); binds.push(body.category || null) }
  if (body.purchase_date !== undefined) { updates.push('purchase_date=?'); binds.push(body.purchase_date || null) }
  if (body.purchase_price_cents !== undefined) { updates.push('purchase_price_cents=?'); binds.push(body.purchase_price_cents) }
  if (body.currency !== undefined) { updates.push('currency=?'); binds.push(body.currency) }
  if (body.vendor_id !== undefined) { updates.push('vendor_id=?'); binds.push(body.vendor_id || null) }
  if (body.department_id !== undefined) { updates.push('department_id=?'); binds.push(body.department_id || null) }
  if (body.site_id !== undefined) { updates.push('site_id=?'); binds.push(body.site_id || null) }
  if (body.custodian !== undefined) { updates.push('custodian=?'); binds.push(body.custodian || null) }
  if (body.status !== undefined) { updates.push('status=?'); binds.push(body.status) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }
  
  updates.push('updated_at=?')
  binds.push(now)
  
  if (updates.length === 1) throw Errors.VALIDATION_ERROR('没有需要更新的字段')
  
  binds.push(id)
  await c.env.DB.prepare(`update fixed_assets set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  // 如果状态、项目、位置或责任人发生变化，记录变动
  if (body.status !== undefined || body.department_id !== undefined || body.site_id !== undefined || body.custodian !== undefined) {
    const changeId = uuid()
    await c.env.DB.prepare(`
      insert into fixed_asset_changes(
        id, asset_id, change_type, change_date,
        from_dept_id, to_dept_id, from_site_id, to_site_id,
        from_custodian, to_custodian, from_status, to_status,
        memo, created_by, created_at
      ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      changeId,
      id,
      'status_change',
      new Date().toISOString().split('T')[0],
      existing.department_id || null,
      body.department_id !== undefined ? (body.department_id || null) : (existing.department_id || null),
      existing.site_id || null,
      body.site_id !== undefined ? (body.site_id || null) : (existing.site_id || null),
      existing.custodian || null,
      body.custodian !== undefined ? (body.custodian || null) : (existing.custodian || null),
      existing.status || null,
      body.status !== undefined ? body.status : existing.status,
      body.memo || null,
      userId || null,
      now
    ).run()
  }
  
  logAuditAction(c, 'update', 'fixed_asset', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除固定资产
fixedAssetsRoutes.delete('/fixed-assets/:id', validateParam(idParamSchema), async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const asset = await c.env.DB.prepare('select asset_code, name from fixed_assets where id = ?').bind(id).first<{ asset_code: string, name: string }>()
  if (!asset) throw Errors.NOT_FOUND()
  
  // 检查是否有折旧记录
  const depCount = await c.env.DB.prepare('select count(1) as n from fixed_asset_depreciations where asset_id = ?').bind(id).first<{ n: number }>()
  if (depCount && depCount.n > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该资产还有折旧记录')
  }
  
  // 删除变动记录
  await c.env.DB.prepare('delete from fixed_asset_changes where asset_id = ?').bind(id).run()
  // 删除资产
  await c.env.DB.prepare('delete from fixed_assets where id = ?').bind(id).run()
  
  logAuditAction(c, 'delete', 'fixed_asset', id, JSON.stringify({ asset_code: asset.asset_code, name: asset.name }))
  return c.json({ ok: true })
})

// 创建折旧记录
fixedAssetsRoutes.post('/fixed-assets/:id/depreciations', validateParam(idParamSchema), validateJson(createDepreciationSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof createDepreciationSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产是否存在
  const asset = await c.env.DB.prepare('select * from fixed_assets where id = ?').bind(id).first()
  if (!asset) throw Errors.NOT_FOUND('asset')
  
  // 计算累计折旧和剩余价值
  const depreciationAmount = body.amount_cents
  const existingDep = await c.env.DB.prepare(`
    select coalesce(sum(depreciation_amount_cents), 0) as total
    from fixed_asset_depreciations
    where asset_id = ?
  `).bind(id).first<{ total: number }>()
  
  const accumulatedDepreciation = (existingDep?.total || 0) + depreciationAmount
  const remainingValue = Number(asset.purchase_price_cents) - accumulatedDepreciation
  
  // 如果剩余价值小于0，不允许继续折旧
  if (remainingValue < 0) {
    throw Errors.BUSINESS_ERROR('折旧金额超过购买价格')
  }
  
  const depId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_depreciations(
      id, asset_id, depreciation_date, depreciation_amount_cents,
      accumulated_depreciation_cents, remaining_value_cents, memo,
      created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    depId,
    id,
    body.depreciation_date,
    depreciationAmount,
    accumulatedDepreciation,
    remainingValue,
    body.memo || null,
    userId || null,
    now
  ).run()
  
  // 更新资产的当前净值
  await c.env.DB.prepare('update fixed_assets set current_value_cents = ?, updated_at = ? where id = ?')
    .bind(remainingValue, now, id).run()
  
  logAuditAction(c, 'create', 'fixed_asset_depreciation', depId, JSON.stringify({
    asset_id: id,
    depreciation_amount_cents: depreciationAmount,
    accumulated_depreciation_cents: accumulatedDepreciation
  }))
  
  return c.json({ id: depId })
})

// 资产调拨
fixedAssetsRoutes.post('/fixed-assets/:id/transfer', validateParam(idParamSchema), validateJson(transferFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof transferFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  if (!body.to_department_id && !body.to_site_id && !body.to_custodian) {
    throw Errors.VALIDATION_ERROR('transfer_date and at least one of to_department_id, to_site_id, to_custodian参数必填')
  }
  
  // 检查资产是否存在
  const asset = await c.env.DB.prepare('select * from fixed_assets where id = ?').bind(id).first()
  if (!asset) throw Errors.NOT_FOUND('asset')
  
  const changeId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_changes(
      id, asset_id, change_type, change_date,
      from_dept_id, to_dept_id, from_site_id, to_site_id,
      from_custodian, to_custodian, memo, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    changeId,
    id,
    'transfer',
    body.transfer_date,
    asset.department_id || null,
    body.to_department_id || null,
    asset.site_id || null,
    body.to_site_id || null,
    asset.custodian || null,
    body.to_custodian || null,
    body.memo || null,
    userId || null,
    now
  ).run()
  
  // 更新资产信息
  const updates: string[] = []
  const binds: any[] = []
  if (body.to_department_id !== undefined) { updates.push('department_id=?'); binds.push(body.to_department_id || null) }
  if (body.to_site_id !== undefined) { updates.push('site_id=?'); binds.push(body.to_site_id || null) }
  if (body.to_custodian !== undefined) { updates.push('custodian=?'); binds.push(body.to_custodian || null) }
  updates.push('updated_at=?')
  binds.push(now)
  binds.push(id)
  
  await c.env.DB.prepare(`update fixed_assets set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  logAuditAction(c, 'update', 'fixed_asset', id, JSON.stringify({ transfer: body }))
  return c.json({ ok: true })
})

// 资产买入（购买资产并创建资产记录+生成支出流水）
fixedAssetsRoutes.post('/fixed-assets/purchase', validateJson(purchaseFixedAssetWithFlowSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof purchaseFixedAssetWithFlowSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产编号是否已存在
  const existed = await c.env.DB.prepare('select id from fixed_assets where asset_code = ?')
    .bind(body.asset_code).first<{ id: string }>()
  if (existed?.id) {
    throw Errors.DUPLICATE('资产代码')
  }
  
  // 验证账户存在且币种匹配
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
  if (account.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('账户币种不匹配')
  }
  
  // 创建资产记录
  const assetId = uuid()
  const purchasePrice = Number(body.purchase_price_cents)
  const purchaseDate = body.purchase_date || new Date().toISOString().split('T')[0]
  
  await c.env.DB.prepare(`
    insert into fixed_assets(
      id, asset_code, name, category, purchase_date, purchase_price_cents,
      currency, vendor_id, department_id, site_id, custodian, status,
      depreciation_method, useful_life_years, current_value_cents, memo,
      created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    assetId,
    body.asset_code,
    body.name,
    body.category || null,
    purchaseDate,
    purchasePrice,
    body.currency,
    body.vendor_id || null,
    body.department_id || null,
    body.site_id || null,
    body.custodian || null,
    'in_use',
    body.depreciation_method || null,
    body.useful_life_years || null,
    purchasePrice,
    body.memo || null,
    userId || null,
    now,
    now
  ).run()
  
  // 生成支出流水（购买资产）
  const flowId = uuid()
  const day = purchaseDate.replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(purchaseDate).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`
  
  // 计算账变前金额
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, purchaseDate, now)
  const balanceAfter = balanceBefore - purchasePrice
  
  // 获取供应商名称
  let vendorName: string | null = null
  if (body.vendor_id) {
    const vendor = await c.env.DB.prepare('select name from vendors where id=?').bind(body.vendor_id).first<{ name: string }>()
    vendorName = vendor?.name || null
  }
  
  // 插入cash_flow记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    flowId, voucherNo, purchaseDate, 'expense', body.account_id, body.category_id,
    null, purchasePrice, body.site_id || null, body.department_id || null,
    vendorName,
    `购买资产：${body.name}（${body.asset_code}）` + (body.memo ? `；${body.memo}` : ''),
    body.voucher_url || null,
    userId || null,
    now
  ).run()
  
  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, flowId, purchaseDate, 'expense', purchasePrice,
    balanceBefore, balanceAfter, now
  ).run()
  
  // 记录资产变动（购买）
  const changeId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_changes(
      id, asset_id, change_type, change_date,
      from_status, to_status, memo, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    changeId,
    assetId,
    'purchase',
    purchaseDate,
    null,
    'in_use',
    `购买资产：${body.name}`,
    userId || null,
    now
  ).run()
  
  logAuditAction(c, 'purchase', 'fixed_asset', assetId, JSON.stringify({
    asset_code: body.asset_code,
    name: body.name,
    purchase_price_cents: purchasePrice,
    flow_id: flowId
  }))
  
  return c.json({ id: assetId, asset_code: body.asset_code, flow_id: flowId, voucher_no: voucherNo })
})

// 资产卖出
fixedAssetsRoutes.post('/fixed-assets/:id/sale', validateParam(idParamSchema), validateJson(sellFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof sellFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产是否存在
  const asset = await c.env.DB.prepare('select * from fixed_assets where id = ?').bind(id).first<any>()
  if (!asset) throw Errors.NOT_FOUND('asset')
  
  // 检查资产状态（不能卖出已卖出或已报废的资产）
  if (asset.status === 'sold') {
    throw Errors.BUSINESS_ERROR('资产已出售')
  }
  
  // 验证账户存在且币种匹配
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
  if (account.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('账户币种不匹配')
  }
  
  // 更新资产状态为已卖出
  await c.env.DB.prepare(`
    update fixed_assets 
    set status=?, sale_date=?, sale_price_cents=?, sale_buyer=?, sale_memo=?, updated_at=?
    where id=?
  `).bind(
    'sold',
    body.sale_date,
    Number(body.sale_price_cents),
    body.sale_buyer || null,
    body.sale_memo || null,
    now,
    id
  ).run()
  
  // 生成收入流水（卖出资产）
  const flowId = uuid()
  const day = body.sale_date.replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(body.sale_date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`
  
  // 计算账变前金额
  const balanceBefore = await getAccountBalanceBefore(c.env.DB, body.account_id, body.sale_date, now)
  const salePrice = Number(body.sale_price_cents)
  const balanceAfter = balanceBefore + salePrice
  
  // 插入cash_flow记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    flowId, voucherNo, body.sale_date, 'income', body.account_id, body.category_id,
    null, salePrice, asset.site_id || null, asset.department_id || null,
    body.sale_buyer || null,
    `卖出资产：${asset.name}（${asset.asset_code}）` + (body.sale_memo || body.memo ? `；${body.sale_memo || body.memo}` : ''),
    body.voucher_url || null,
    userId || null,
    now
  ).run()
  
  // 生成账变记录
  const transactionId = uuid()
  await c.env.DB.prepare(`
    insert into account_transactions(
      id, account_id, flow_id, transaction_date, transaction_type, amount_cents,
      balance_before_cents, balance_after_cents, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    transactionId, body.account_id, flowId, body.sale_date, 'income', salePrice,
    balanceBefore, balanceAfter, now
  ).run()
  
  // 记录资产变动（卖出）
  const changeId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_changes(
      id, asset_id, change_type, change_date,
      from_status, to_status, memo, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    changeId,
    id,
    'sale',
    body.sale_date,
    asset.status,
    'sold',
    `卖出资产：${asset.name}，卖出价格：${(salePrice / 100).toFixed(2)} ${asset.currency}`,
    userId || null,
    now
  ).run()
  
  logAuditAction(c, 'sale', 'fixed_asset', id, JSON.stringify({
    asset_code: asset.asset_code,
    name: asset.name,
    sale_price_cents: salePrice,
    flow_id: flowId
  }))
  
  return c.json({ ok: true, flow_id: flowId, voucher_no: voucherNo })
})

// 资产分配（员工入职领取设备等）
fixedAssetsRoutes.post('/fixed-assets/:id/allocate', validateParam(idParamSchema), validateJson(allocateFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager', 'hr']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof allocateFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查资产是否存在
  const asset = await c.env.DB.prepare('select * from fixed_assets where id = ?').bind(id).first<any>()
  if (!asset) throw Errors.NOT_FOUND('asset')
  
  // 检查资产状态（只能分配在用或闲置的资产）
  if (asset.status !== 'in_use' && asset.status !== 'idle') {
    throw Errors.BUSINESS_ERROR('只能分配使用中或闲置的资产')
  }
  
  // 检查员工是否存在
  const employee = await c.env.DB.prepare('select * from employees where id=?').bind(body.employee_id).first<any>()
  if (!employee) throw Errors.NOT_FOUND('员工')
  if (employee.active === 0) throw Errors.BUSINESS_ERROR('员工已停用')
  
  // 检查是否已有未归还的分配记录
  const existingAllocation = await c.env.DB.prepare(`
    select id from fixed_asset_allocations 
    where asset_id=? and return_date is null
  `).bind(id).first<{ id: string }>()
  if (existingAllocation?.id) {
    throw Errors.BUSINESS_ERROR('资产已分配且未归还')
  }
  
  // 创建分配记录
  const allocationId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_allocations(
      id, asset_id, employee_id, allocation_date, allocation_type, memo, created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?)
  `).bind(
    allocationId,
    id,
    body.employee_id,
    body.allocation_date,
    body.allocation_type || 'employee_onboarding',
    body.memo || null,
    userId || null,
    now,
    now
  ).run()
  
  // 更新资产信息：设置为在用状态，更新责任人为员工姓名
  await c.env.DB.prepare(`
    update fixed_assets 
    set status=?, custodian=?, department_id=?, updated_at=?
    where id=?
  `).bind(
    'in_use',
    employee.name,
    employee.department_id || asset.department_id,
    now,
    id
  ).run()
  
  // 记录资产变动（分配）
  const changeId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_changes(
      id, asset_id, change_type, change_date,
      from_custodian, to_custodian, from_status, to_status, memo, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    changeId,
    id,
    'allocation',
    body.allocation_date,
    asset.custodian || null,
    employee.name,
    asset.status,
    'in_use',
    `分配给员工：${employee.name}（${body.allocation_type === 'employee_onboarding' ? '员工入职' : body.allocation_type === 'transfer' ? '调拨' : '临时借用'}）`,
    userId || null,
    now
  ).run()
  
  logAuditAction(c, 'allocate', 'fixed_asset', id, JSON.stringify({
    asset_code: asset.asset_code,
    name: asset.name,
    employee_id: body.employee_id,
    employee_name: employee.name,
    allocation_type: body.allocation_type || 'employee_onboarding'
  }))
  
  return c.json({ id: allocationId })
})

// 资产归还
fixedAssetsRoutes.post('/fixed-assets/allocations/:id/return', validateParam(idParamSchema), validateJson(returnFixedAssetSchema), async (c) => {
  if (!(await requireRole(c, ['finance', 'manager', 'hr']))) throw Errors.FORBIDDEN()
  const params = getValidatedParams<z.infer<typeof idParamSchema>>(c)
  const id = params.id
  const body = getValidatedData<z.infer<typeof returnFixedAssetSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查分配记录是否存在
  const allocation = await c.env.DB.prepare(`
    select a.*, fa.asset_code, fa.name as asset_name, e.name as employee_name
    from fixed_asset_allocations a
    left join fixed_assets fa on fa.id = a.asset_id
    left join employees e on e.id = a.employee_id
    where a.id = ?
  `).bind(id).first<any>()
  if (!allocation) throw Errors.NOT_FOUND('allocation')
  
  // 检查是否已归还
  if (allocation.return_date) {
    throw Errors.BUSINESS_ERROR('资产已归还')
  }
  
  // 更新分配记录
  await c.env.DB.prepare(`
    update fixed_asset_allocations 
    set return_date=?, memo=?, updated_at=?
    where id=?
  `).bind(
    body.return_date,
    body.memo || allocation.memo || null,
    now,
    id
  ).run()
  
  // 更新资产状态为闲置
  await c.env.DB.prepare(`
    update fixed_assets 
    set status=?, custodian=?, updated_at=?
    where id=?
  `).bind(
    'idle',
    null,
    now,
    allocation.asset_id
  ).run()
  
  // 记录资产变动（归还）
  const changeId = uuid()
  await c.env.DB.prepare(`
    insert into fixed_asset_changes(
      id, asset_id, change_type, change_date,
      from_custodian, to_custodian, from_status, to_status, memo, created_by, created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    changeId,
    allocation.asset_id,
    'return',
    body.return_date,
    allocation.employee_name || null,
    null,
    'in_use',
    'idle',
    `归还资产：${allocation.asset_name}`,
    userId || null,
    now
  ).run()
  
  logAuditAction(c, 'return', 'fixed_asset_allocation', id, JSON.stringify({
    asset_id: allocation.asset_id,
    asset_code: allocation.asset_code,
    employee_id: allocation.employee_id
  }))
  
  return c.json({ ok: true })
})
