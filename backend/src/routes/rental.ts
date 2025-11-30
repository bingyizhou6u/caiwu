import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { isHQDirector, isHQFinance, isHQHR, isProjectDirector, isProjectFinance, getUserPosition, getDataAccessFilter } from '../utils/permissions.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { FinanceService } from '../services/FinanceService.js'
import { applyDataScope } from '../utils/permissions.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData, validateQuery, getValidatedQuery } from '../utils/validator.js'
import { createRentalPaymentSchema, updateRentalPaymentSchema, allocateDormitorySchema, createRentalPropertySchema } from '../schemas/business.schema.js'
import { rentalPropertyQuerySchema } from '../schemas/common.schema.js'
import type { z } from 'zod'

export const rentalRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取租赁房屋列表
rentalRoutes.get('/rental-properties', validateQuery(rentalPropertyQuerySchema), async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const query = getValidatedQuery<z.infer<typeof rentalPropertyQuerySchema>>(c)
  const propertyType = query.property_type
  const status = query.status
  const departmentId = query.department_id

  let sql = `
    select 
      rp.*,
      d.name as department_name,
      a.name as payment_account_name,
      cur.name as currency_name,
      u.name as created_by_name
    from rental_properties rp
    left join departments d on d.id = rp.department_id
    left join accounts a on a.id = rp.payment_account_id
    left join currencies cur on cur.code = rp.currency
    left join users u on u.id = rp.created_by
  `
  const conds: string[] = []
  const binds: any[] = []

  if (propertyType) {
    conds.push('rp.property_type = ?')
    binds.push(propertyType)
  }
  if (status) {
    conds.push('rp.status = ?')
    binds.push(status)
  }
  if (departmentId) {
    conds.push('rp.department_id = ?')
    binds.push(departmentId)
  }

  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by rp.created_at desc'

  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 获取员工宿舍分配记录列表（必须在 /rental-properties/:id 之前定义，避免路由冲突）
rentalRoutes.get('/rental-properties/allocations', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const propertyId = c.req.query('property_id')
  const employeeId = c.req.query('employee_id')
  const returned = c.req.query('returned') // 'true' | 'false' | undefined

  let sql = `
    select 
      da.*,
      rp.property_code,
      rp.name as property_name,
      e.name as employee_name,
      e.department_id as employee_department_id,
      d.name as employee_department_name,
      u.name as created_by_name
    from dormitory_allocations da
    left join rental_properties rp on rp.id = da.property_id
    left join employees e on e.id = da.employee_id
    left join departments d on d.id = e.department_id
    left join users u on u.id = da.created_by
  `
  const conds: string[] = []
  const binds: any[] = []

  if (propertyId) {
    conds.push('da.property_id=?')
    binds.push(propertyId)
  }
  if (employeeId) {
    conds.push('da.employee_id=?')
    binds.push(employeeId)
  }
  if (returned === 'true') {
    conds.push('da.return_date is not null')
  } else if (returned === 'false') {
    conds.push('da.return_date is null')
  }

  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by da.allocation_date desc, da.created_at desc'

  try {
    // 应用数据权限过滤
    const scoped = await applyDataScope(c, sql, binds)
    console.log('Applied data scope:', {
      originalSql: sql,
      scopedSql: scoped.sql,
      originalBinds: binds,
      scopedBinds: scoped.binds
    })

    // 执行查询
    const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
    return c.json({ results: rows.results ?? [] })
  } catch (error: any) {
    // 记录错误详情以便调试
    console.error('Error in /rental-properties/allocations:', {
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorStatus: error.statusCode,
      originalSql: sql,
      originalBinds: binds,
      userId: c.get('userId'),
      userPosition: c.get('userPosition'),
      userEmployee: c.get('userEmployee')
    })

    // 如果是AppError，直接抛出
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // 其他错误包装为内部错误
    throw Errors.INTERNAL_ERROR(`查询失败: ${error.message}`)
  }
})

// 获取单个租赁房屋详情
rentalRoutes.get('/rental-properties/:id', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const property = await c.env.DB.prepare(`
    select 
      rp.*,
      d.name as department_name,
      a.name as payment_account_name,
      cur.name as currency_name,
      u.name as created_by_name
    from rental_properties rp
    left join departments d on d.id = rp.department_id
    left join accounts a on a.id = rp.payment_account_id
    left join currencies cur on cur.code = rp.currency
    left join users u on u.id = rp.created_by
    where rp.id = ?
  `).bind(id).first()

  if (!property) throw Errors.NOT_FOUND()

  // 优化：并行查询付款记录、变动记录和分配记录
  const [payments, changes, allocationsResult] = await Promise.all([
    c.env.DB.prepare(`
      select * from rental_payments
      where property_id = ?
      order by year desc, month desc
    `).bind(id).all(),
    c.env.DB.prepare(`
      select * from rental_changes
      where property_id = ?
      order by change_date desc
    `).bind(id).all(),
    property.property_type === 'dormitory'
      ? c.env.DB.prepare(`
          select 
            da.*,
            e.name as employee_name,
            d.name as employee_department_name
          from dormitory_allocations da
          left join employees e on e.id = da.employee_id
          left join departments d on d.id = e.department_id
          where da.property_id = ?
          order by da.allocation_date desc
        `).bind(id).all()
      : Promise.resolve({ results: [] })
  ])

  return c.json({
    ...property,
    payments: payments.results ?? [],
    changes: changes.results ?? [],
    allocations: allocationsResult.results ?? []
  })
})

// 创建租赁房屋
rentalRoutes.post('/rental-properties', validateJson(createRentalPropertySchema), async (c) => {
  const canCreate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canCreate) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createRentalPropertySchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查房屋编号是否已存在
  const existed = await c.env.DB.prepare('select id from rental_properties where property_code = ?')
    .bind(body.property_code).first<{ id: string }>()
  if (existed?.id) {
    throw Errors.DUPLICATE('物业代码')
  }

  const id = uuid()
  await c.env.DB.prepare(`
    insert into rental_properties(
      id, property_code, name, property_type, address, area_sqm,
      rent_type, monthly_rent_cents, yearly_rent_cents, currency,
      payment_period_months, landlord_name, landlord_contact,
      lease_start_date, lease_end_date, deposit_cents, payment_method,
      payment_account_id, payment_day, department_id, status,
      memo, contract_file_url, created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.property_code,
    body.name,
    body.property_type,
    body.address || null,
    body.area_sqm || null,
    body.rent_type || 'monthly',
    body.monthly_rent_cents ? Number(body.monthly_rent_cents) : null,
    body.yearly_rent_cents ? Number(body.yearly_rent_cents) : null,
    body.currency,
    body.payment_period_months || 1,
    body.landlord_name || null,
    body.landlord_contact || null,
    body.lease_start_date || null,
    body.lease_end_date || null,
    body.deposit_cents ? Number(body.deposit_cents) : null,
    body.payment_method || null,
    body.payment_account_id || null,
    body.payment_day || 1,
    body.property_type === 'office' ? (body.department_id || null) : null,
    body.status || 'active',
    body.memo || null,
    body.contract_file_url || null,
    userId || null,
    now,
    now
  ).run()

  logAuditAction(c, 'create', 'rental_property', id, JSON.stringify({
    property_code: body.property_code,
    name: body.name,
    property_type: body.property_type
  }))

  return c.json({ id, property_code: body.property_code })
})

// 更新租赁房屋
rentalRoutes.put('/rental-properties/:id', async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<any>()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查房屋是否存在
  const existing = await c.env.DB.prepare('select * from rental_properties where id = ?').bind(id).first()
  if (!existing) throw Errors.NOT_FOUND()

  const updates: string[] = []
  const binds: any[] = []

  if (body.name !== undefined) { updates.push('name=?'); binds.push(body.name) }
  if (body.property_type !== undefined) { updates.push('property_type=?'); binds.push(body.property_type) }
  if (body.address !== undefined) { updates.push('address=?'); binds.push(body.address || null) }
  if (body.area_sqm !== undefined) { updates.push('area_sqm=?'); binds.push(body.area_sqm || null) }
  if (body.rent_type !== undefined) { updates.push('rent_type=?'); binds.push(body.rent_type) }
  if (body.monthly_rent_cents !== undefined) { updates.push('monthly_rent_cents=?'); binds.push(body.monthly_rent_cents ? Number(body.monthly_rent_cents) : null) }
  if (body.yearly_rent_cents !== undefined) { updates.push('yearly_rent_cents=?'); binds.push(body.yearly_rent_cents ? Number(body.yearly_rent_cents) : null) }
  if (body.currency !== undefined) { updates.push('currency=?'); binds.push(body.currency) }
  if (body.payment_period_months !== undefined) { updates.push('payment_period_months=?'); binds.push(body.payment_period_months || 1) }
  if (body.landlord_name !== undefined) { updates.push('landlord_name=?'); binds.push(body.landlord_name || null) }
  if (body.landlord_contact !== undefined) { updates.push('landlord_contact=?'); binds.push(body.landlord_contact || null) }
  if (body.lease_start_date !== undefined) { updates.push('lease_start_date=?'); binds.push(body.lease_start_date || null) }
  if (body.lease_end_date !== undefined) { updates.push('lease_end_date=?'); binds.push(body.lease_end_date || null) }
  if (body.deposit_cents !== undefined) { updates.push('deposit_cents=?'); binds.push(body.deposit_cents ? Number(body.deposit_cents) : null) }
  if (body.payment_method !== undefined) { updates.push('payment_method=?'); binds.push(body.payment_method || null) }
  if (body.payment_account_id !== undefined) { updates.push('payment_account_id=?'); binds.push(body.payment_account_id || null) }
  if (body.payment_day !== undefined) { updates.push('payment_day=?'); binds.push(body.payment_day || 1) }
  if (body.department_id !== undefined) {
    const deptId = body.property_type === 'office' ? (body.department_id || null) : null
    updates.push('department_id=?')
    binds.push(deptId)
  }
  if (body.status !== undefined) { updates.push('status=?'); binds.push(body.status) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }
  if (body.contract_file_url !== undefined) { updates.push('contract_file_url=?'); binds.push(body.contract_file_url || null) }

  updates.push('updated_at=?')
  binds.push(now)

  if (updates.length === 1) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  binds.push(id)
  await c.env.DB.prepare(`update rental_properties set ${updates.join(',')} where id=?`).bind(...binds).run()

  // 如果状态、租金、租期发生变化，记录变动
  if (body.status !== undefined || body.monthly_rent_cents !== undefined || body.yearly_rent_cents !== undefined || body.rent_type !== undefined || body.lease_start_date !== undefined || body.lease_end_date !== undefined) {
    const changeId = uuid()
    await c.env.DB.prepare(`
      insert into rental_changes(
        id, property_id, change_type, change_date,
        from_lease_start, to_lease_start, from_lease_end, to_lease_end,
        from_monthly_rent_cents, to_monthly_rent_cents,
        from_status, to_status, memo, created_by, created_at
      ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      changeId,
      id,
      'modify',
      new Date().toISOString().split('T')[0],
      existing.lease_start_date || null,
      body.lease_start_date !== undefined ? (body.lease_start_date || null) : (existing.lease_start_date || null),
      existing.lease_end_date || null,
      body.lease_end_date !== undefined ? (body.lease_end_date || null) : (existing.lease_end_date || null),
      existing.monthly_rent_cents || null,
      body.monthly_rent_cents !== undefined ? Number(body.monthly_rent_cents) : (existing.monthly_rent_cents || null),
      existing.status || null,
      body.status !== undefined ? body.status : existing.status,
      body.memo || null,
      userId || null,
      now
    ).run()
  }

  logAuditAction(c, 'update', 'rental_property', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除租赁房屋
rentalRoutes.delete('/rental-properties/:id', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const property = await c.env.DB.prepare('select property_code, name from rental_properties where id = ?').bind(id).first<{ property_code: string, name: string }>()
  if (!property) throw Errors.NOT_FOUND()

  // 检查是否有付款记录
  const paymentCount = await c.env.DB.prepare('select count(1) as n from rental_payments where property_id = ?').bind(id).first<{ n: number }>()
  if (paymentCount && paymentCount.n > 0) {
    throw Errors.BUSINESS_ERROR('无法删除，该物业还有付款记录')
  }

  // 删除变动记录和分配记录
  await c.env.DB.prepare('delete from rental_changes where property_id = ?').bind(id).run()
  await c.env.DB.prepare('delete from dormitory_allocations where property_id = ?').bind(id).run()
  // 删除房屋
  await c.env.DB.prepare('delete from rental_properties where id = ?').bind(id).run()

  logAuditAction(c, 'delete', 'rental_property', id, JSON.stringify({ property_code: property.property_code, name: property.name }))
  return c.json({ ok: true })
})

// 创建租赁付款记录
rentalRoutes.post('/rental-payments', validateJson(createRentalPaymentSchema), async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createRentalPaymentSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查房屋是否存在
  const property = await c.env.DB.prepare('select * from rental_properties where id = ?').bind(body.property_id).first<any>()
  if (!property) throw Errors.NOT_FOUND('property')

  // 检查是否已存在该月份的付款记录
  const existing = await c.env.DB.prepare(`
    select id from rental_payments 
    where property_id=? and year=? and month=?
  `).bind(body.property_id, body.year, body.month).first<{ id: string }>()
  if (existing?.id) {
    throw Errors.DUPLICATE('该月的付款记录')
  }

  // 验证账户存在且币种匹配
  const account = await c.env.DB.prepare('select * from accounts where id=?').bind(body.account_id).first<any>()
  if (!account) throw Errors.NOT_FOUND('账户')
  if (account.active === 0) throw Errors.BUSINESS_ERROR('账户已停用')
  if (account.currency !== body.currency) {
    throw Errors.BUSINESS_ERROR('账户币种不匹配')
  }

  // 创建付款记录
  const paymentId = uuid()
  const amount = Number(body.amount_cents)

  await c.env.DB.prepare(`
    insert into rental_payments(
      id, property_id, payment_date, year, month, amount_cents, currency,
      account_id, category_id, payment_method, voucher_url, memo,
      created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    paymentId,
    body.property_id,
    body.payment_date,
    body.year,
    body.month,
    amount,
    body.currency,
    body.account_id,
    body.category_id || null,
    body.payment_method || null,
    body.voucher_url || null,
    body.memo || null,
    userId || null,
    now,
    now
  ).run()

  // 生成支出流水（支付租金）
  const flowId = uuid()
  const day = body.payment_date.replace(/-/g, '')
  const count = await c.env.DB
    .prepare('select count(1) as n from cash_flows where biz_date=?')
    .bind(body.payment_date).first<{ n: number }>()
  const seq = ((count?.n ?? 0) + 1).toString().padStart(3, '0')
  const voucherNo = `JZ${day}-${seq}`

  // 计算账变前金额
  const balanceBefore = await new FinanceService(c.env.DB).getAccountBalanceBefore(body.account_id, body.payment_date, now)
  const balanceAfter = balanceBefore - amount

  // 插入cash_flow记录
  await c.env.DB.prepare(`
    insert into cash_flows(
      id,voucher_no,biz_date,type,account_id,category_id,method,amount_cents,
      site_id,department_id,counterparty,memo,voucher_url,created_by,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    flowId, voucherNo, body.payment_date, 'expense', body.account_id, body.category_id || null,
    body.payment_method || null, amount, null, property.department_id || null,
    property.landlord_name || null,
    `支付租金：${property.name}（${property.property_code}）` + (body.memo ? `；${body.memo}` : ''),
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
    transactionId, body.account_id, flowId, body.payment_date, 'expense', amount,
    balanceBefore, balanceAfter, now
  ).run()

  // 如果有对应的应付账单，标记为已付
  await c.env.DB.prepare(`
    update rental_payable_bills
    set status='paid', paid_date=?, paid_payment_id=?, updated_at=?
    where property_id=? and year=? and month=? and status='unpaid'
  `).bind(
    body.payment_date,
    paymentId,
    now,
    body.property_id,
    body.year,
    body.month
  ).run()

  logAuditAction(c, 'create', 'rental_payment', paymentId, JSON.stringify({
    property_id: body.property_id,
    property_code: property.property_code,
    year: body.year,
    month: body.month,
    amount_cents: amount,
    flow_id: flowId
  }))

  return c.json({ id: paymentId, flow_id: flowId, voucher_no: voucherNo })
})

// 获取租赁付款记录列表
rentalRoutes.get('/rental-payments', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const propertyId = c.req.query('property_id')
  const year = c.req.query('year')
  const month = c.req.query('month')

  let sql = `
    select 
      rp.*,
      rprop.property_code,
      rprop.name as property_name,
      rprop.property_type,
      a.name as account_name,
      c.name as category_name,
      u.name as created_by_name
    from rental_payments rp
    left join rental_properties rprop on rprop.id = rp.property_id
    left join accounts a on a.id = rp.account_id
    left join categories c on c.id = rp.category_id
    left join users u on u.id = rp.created_by
  `
  const conds: string[] = []
  const binds: any[] = []

  if (propertyId) {
    conds.push('rp.property_id=?')
    binds.push(propertyId)
  }
  if (year) {
    conds.push('rp.year=?')
    binds.push(Number(year))
  }
  if (month) {
    conds.push('rp.month=?')
    binds.push(Number(month))
  }

  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by rp.year desc, rp.month desc, rp.created_at desc'

  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 更新租赁付款记录
rentalRoutes.put('/rental-payments/:id', validateJson(updateRentalPaymentSchema), async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateRentalPaymentSchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查付款记录是否存在
  const existing = await c.env.DB.prepare('select * from rental_payments where id = ?').bind(id).first()
  if (!existing) throw Errors.NOT_FOUND()

  const updates: string[] = []
  const binds: any[] = []

  if (body.payment_date !== undefined) { updates.push('payment_date=?'); binds.push(body.payment_date) }
  if (body.amount_cents !== undefined) { updates.push('amount_cents=?'); binds.push(Number(body.amount_cents)) }
  if (body.voucher_url !== undefined) { updates.push('voucher_url=?'); binds.push(body.voucher_url || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }

  updates.push('updated_at=?')
  binds.push(now)

  if (updates.length === 1) throw Errors.VALIDATION_ERROR('没有需要更新的字段')

  binds.push(id)
  await c.env.DB.prepare(`update rental_payments set ${updates.join(',')} where id=?`).bind(...binds).run()

  logAuditAction(c, 'update', 'rental_payment', id, JSON.stringify(body))
  return c.json({ ok: true })
})

// 删除租赁付款记录
rentalRoutes.delete('/rental-payments/:id', async (c) => {
  if (!isHQDirector(c)) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const payment = await c.env.DB.prepare('select property_id, year, month from rental_payments where id = ?').bind(id).first<{ property_id: string, year: number, month: number }>()
  if (!payment) throw Errors.NOT_FOUND()

  await c.env.DB.prepare('delete from rental_payments where id = ?').bind(id).run()

  logAuditAction(c, 'delete', 'rental_payment', id, JSON.stringify({ property_id: payment.property_id, year: payment.year, month: payment.month }))
  return c.json({ ok: true })
})

// 员工宿舍分配
rentalRoutes.post('/rental-properties/:id/allocate-dormitory', validateJson(allocateDormitorySchema), async (c) => {
  const canManage = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c) || isHQHR(c)
  if (!canManage) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof allocateDormitorySchema>>(c)
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查房屋是否存在且为员工宿舍
  const property = await c.env.DB.prepare('select * from rental_properties where id = ?').bind(id).first<any>()
  if (!property) throw Errors.NOT_FOUND('property')
  if (property.property_type !== 'dormitory') {
    throw Errors.BUSINESS_ERROR('该物业不是宿舍')
  }

  // 检查员工是否存在
  const employee = await c.env.DB.prepare('select * from employees where id=?').bind(body.employee_id).first<any>()
  if (!employee) throw Errors.NOT_FOUND('员工')
  if (employee.active === 0) throw Errors.BUSINESS_ERROR('员工已停用')

  // 检查是否已有未归还的分配记录
  const existingAllocation = await c.env.DB.prepare(`
    select id from dormitory_allocations 
    where property_id=? and employee_id=? and return_date is null
  `).bind(id, body.employee_id).first<{ id: string }>()
  if (existingAllocation?.id) {
    throw Errors.DUPLICATE('员工已分配到该宿舍')
  }

  // 创建分配记录
  const allocationId = uuid()
  await c.env.DB.prepare(`
    insert into dormitory_allocations(
      id, property_id, employee_id, room_number, bed_number,
      allocation_date, monthly_rent_cents, memo, created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    allocationId,
    id,
    body.employee_id,
    body.room_number || null,
    body.bed_number || null,
    body.allocation_date,
    body.monthly_rent_cents ? Number(body.monthly_rent_cents) : null,
    body.memo || null,
    userId || null,
    now,
    now
  ).run()

  logAuditAction(c, 'allocate', 'dormitory', allocationId, JSON.stringify({
    property_id: id,
    property_code: property.property_code,
    employee_id: body.employee_id,
    employee_name: employee.name
  }))

  return c.json({ id: allocationId })
})

// 员工宿舍归还
rentalRoutes.post('/rental-properties/allocations/:id/return', async (c) => {
  const canManage = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c) || isHQHR(c)
  if (!canManage) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{
    return_date: string
    memo?: string
  }>()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 验证必填字段
  if (!body.return_date) {
    throw Errors.VALIDATION_ERROR('return_date参数必填')
  }

  // 检查分配记录是否存在
  const allocation = await c.env.DB.prepare(`
    select da.*, rp.property_code, rp.name as property_name, e.name as employee_name
    from dormitory_allocations da
    left join rental_properties rp on rp.id = da.property_id
    left join employees e on e.id = da.employee_id
    where da.id = ?
  `).bind(id).first<any>()
  if (!allocation) throw Errors.NOT_FOUND('allocation')

  // 检查是否已归还
  if (allocation.return_date) {
    throw Errors.BUSINESS_ERROR('已归还')
  }

  // 更新分配记录
  await c.env.DB.prepare(`
    update dormitory_allocations 
    set return_date=?, memo=?, updated_at=?
    where id=?
  `).bind(
    body.return_date,
    body.memo || allocation.memo || null,
    now,
    id
  ).run()

  logAuditAction(c, 'return', 'dormitory_allocation', id, JSON.stringify({
    property_id: allocation.property_id,
    property_code: allocation.property_code,
    employee_id: allocation.employee_id
  }))

  return c.json({ ok: true })
})

// 生成租赁应付账单（提前15天自动生成）
rentalRoutes.post('/rental-properties/generate-payable-bills', async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 获取所有活跃的租赁房屋
  const properties = await c.env.DB.prepare(`
    select * from rental_properties
    where status = 'active'
    and lease_start_date is not null
  `).all()

  const generated: any[] = []

  for (const prop of (properties.results ?? [])) {
    if (!prop.lease_start_date || !prop.lease_end_date) continue

    const leaseStart = new Date(prop.lease_start_date as string)
    const leaseEnd = new Date(prop.lease_end_date as string)
    const paymentPeriodMonths = (prop.payment_period_months as number) || 1
    const paymentDay = (prop.payment_day as number) || 1

    // 计算下一个付款日期
    let nextPaymentDate = new Date(leaseStart)

    // 找到下一个付款日期（基于付款周期和付款日）
    while (nextPaymentDate <= today || nextPaymentDate.getDate() !== paymentDay) {
      if (nextPaymentDate <= today) {
        // 如果已过当前日期，跳到下一个付款周期
        nextPaymentDate = new Date(nextPaymentDate)
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentPeriodMonths)
        nextPaymentDate.setDate(paymentDay)
      } else {
        // 调整到正确的付款日
        nextPaymentDate.setDate(paymentDay)
      }
    }

    // 如果下个付款日期超过租期结束日期，跳过
    if (nextPaymentDate > leaseEnd) continue

    // 计算账单生成日期（付款日期前15天）
    const billDate = new Date(nextPaymentDate)
    billDate.setDate(billDate.getDate() - 15)
    const billDateStr = billDate.toISOString().split('T')[0]
    const dueDateStr = nextPaymentDate.toISOString().split('T')[0]

    // 如果账单生成日期还未到，跳过
    if (billDateStr > todayStr) continue

    // 计算应付金额
    let amountCents = 0
    if (prop.rent_type === 'yearly') {
      // 年租：根据付款周期计算
      amountCents = Math.round(((prop.yearly_rent_cents as number) || 0) / (12 / paymentPeriodMonths))
    } else {
      // 月租：根据付款周期计算
      amountCents = Math.round(((prop.monthly_rent_cents as number) || 0) * paymentPeriodMonths)
    }

    // 检查是否已存在该月份的应付账单
    const existingBill = await c.env.DB.prepare(`
      select id from rental_payable_bills
      where property_id = ? and year = ? and month = ? and status = 'unpaid'
    `).bind(
      prop.id,
      nextPaymentDate.getFullYear(),
      nextPaymentDate.getMonth() + 1
    ).first<{ id: string }>()

    if (existingBill?.id) continue // 已存在，跳过

    // 创建应付账单
    const billId = uuid()
    await c.env.DB.prepare(`
      insert into rental_payable_bills(
        id, property_id, bill_date, due_date, year, month,
        amount_cents, currency, payment_period_months, status,
        memo, created_by, created_at, updated_at
      ) values(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      billId,
      prop.id,
      billDateStr,
      dueDateStr,
      nextPaymentDate.getFullYear(),
      nextPaymentDate.getMonth() + 1,
      amountCents,
      prop.currency,
      paymentPeriodMonths,
      'unpaid',
      `自动生成：${prop.name}（${prop.property_code}）`,
      userId || null,
      now,
      now
    ).run()

    generated.push({
      id: billId,
      property_code: prop.property_code,
      property_name: prop.name,
      due_date: dueDateStr,
      amount_cents: amountCents
    })
  }

  logAuditAction(c, 'generate', 'rental_payable_bills', '', JSON.stringify({
    count: generated.length,
    generated: generated.map(g => g.property_code)
  }))

  return c.json({ generated: generated.length, bills: generated })
})

// 获取应付账单列表
rentalRoutes.get('/rental-payable-bills', async (c) => {
  if (!getUserPosition(c)) throw Errors.FORBIDDEN()
  const propertyId = c.req.query('property_id')
  const status = c.req.query('status')
  const startDate = c.req.query('start_date')
  const endDate = c.req.query('end_date')

  let sql = `
    select 
      rpb.*,
      rp.property_code,
      rp.name as property_name,
      rp.property_type,
      cur.name as currency_name,
      u.name as created_by_name,
      rp.payment_account_id
    from rental_payable_bills rpb
    left join rental_properties rp on rp.id = rpb.property_id
    left join currencies cur on cur.code = rpb.currency
    left join users u on u.id = rpb.created_by
  `
  const conds: string[] = []
  const binds: any[] = []

  if (propertyId) {
    conds.push('rpb.property_id=?')
    binds.push(propertyId)
  }
  if (status) {
    conds.push('rpb.status=?')
    binds.push(status)
  }
  if (startDate) {
    conds.push('rpb.due_date>=?')
    binds.push(startDate)
  }
  if (endDate) {
    conds.push('rpb.due_date<=?')
    binds.push(endDate)
  }

  if (conds.length) sql += ' where ' + conds.join(' and ')
  sql += ' order by rpb.due_date asc, rpb.created_at desc'

  // 应用数据权限过滤
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 标记应付账单为已付
rentalRoutes.post('/rental-payable-bills/:id/mark-paid', async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{
    paid_date: string
    paid_payment_id?: string
  }>()
  const userId = c.get('userId') as string | undefined
  const now = Date.now()

  // 检查账单是否存在
  const bill = await c.env.DB.prepare('select * from rental_payable_bills where id = ?').bind(id).first()
  if (!bill) throw Errors.NOT_FOUND()

  if (bill.status === 'paid') {
    throw Errors.BUSINESS_ERROR('已支付')
  }

  // 更新账单状态
  await c.env.DB.prepare(`
    update rental_payable_bills
    set status='paid', paid_date=?, paid_payment_id=?, updated_at=?
    where id=?
  `).bind(
    body.paid_date,
    body.paid_payment_id || null,
    now,
    id
  ).run()

  logAuditAction(c, 'update', 'rental_payable_bill', id, JSON.stringify({
    status: 'paid',
    paid_date: body.paid_date
  }))

  return c.json({ ok: true })
})

// 文件上传：租房合同PDF
rentalRoutes.post('/upload/contract', async (c) => {
  const canUpdate = isHQFinance(c) || isProjectFinance(c) || isHQDirector(c) || isProjectDirector(c)
  if (!canUpdate) throw Errors.FORBIDDEN()

  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) throw Errors.VALIDATION_ERROR('文件必填')

  // 限制文件大小（20MB）
  const maxSize = 20 * 1024 * 1024
  if (file.size > maxSize) throw Errors.VALIDATION_ERROR('文件过大（最大20MB）')

  // 限制文件类型：只允许PDF格式
  const allowedTypes = ['application/pdf']
  if (!allowedTypes.includes(file.type)) {
    throw Errors.VALIDATION_ERROR('只允许上传PDF格式文件')
  }

  try {
    // 生成唯一文件名：时间戳-随机字符串.pdf
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${random}.pdf`
    const key = `contracts/${fileName}`

    // 上传到R2
    const bucket = c.env.VOUCHERS as R2Bucket
    await bucket.put(key, file, {
      httpMetadata: {
        contentType: 'application/pdf',
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

export default rentalRoutes
