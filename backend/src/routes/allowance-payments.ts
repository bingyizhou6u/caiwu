import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { requireRole, requirePermission, canRead, canWrite, isEmployee, isHR, getCurrentUserId } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { generateAllowancePaymentsSchema, createAllowancePaymentSchema, updateAllowancePaymentSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

export const allowancePaymentsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 补贴发放管理 - 列表
allowancePaymentsRoutes.get('/allowance-payments', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  const year = c.req.query('year')
  const month = c.req.query('month')
  const employeeId = c.req.query('employee_id')
  const allowanceType = c.req.query('allowance_type')
  const userId = getCurrentUserId(c)
  
  let sql = `
    select 
      ap.*,
      e.name as employee_name,
      e.department_id,
      d.name as department_name,
      c.name as currency_name,
      u.name as created_by_name
    from allowance_payments ap
    left join employees e on e.id = ap.employee_id
    left join departments d on d.id = e.department_id
    left join currencies c on c.code = ap.currency_id
    left join users u on u.id = ap.created_by
    where 1=1
  `
  const binds: any[] = []
  
  // employee角色只能查看自己的补贴（通过email匹配employee_id）
  if (await isEmployee(c) && userId) {
    const { getUserEmployeeId } = await import('../utils/db.js')
    const userEmployeeId = await getUserEmployeeId(c.env.DB, userId)
    if (userEmployeeId) {
      sql += ' and ap.employee_id = ?'
      binds.push(userEmployeeId)
    } else {
      return c.json({ results: [] })
    }
  }
  
  if (year) {
    sql += ' and ap.year = ?'
    binds.push(parseInt(year as string))
  }
  if (month) {
    sql += ' and ap.month = ?'
    binds.push(parseInt(month as string))
  }
  if (employeeId) {
    sql += ' and ap.employee_id = ?'
    binds.push(employeeId)
  }
  if (allowanceType) {
    sql += ' and ap.allowance_type = ?'
    binds.push(allowanceType)
  }
  
  sql += ' order by ap.year desc, ap.month desc, e.name, ap.allowance_type'
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 补贴发放管理 - 生成补贴发放记录（基于员工补贴配置）
allowancePaymentsRoutes.post('/allowance-payments/generate', validateJson(generateAllowancePaymentsSchema), async (c) => {
  if (!(await requireRole(c, ['manager', 'finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof generateAllowancePaymentsSchema>>(c)
  
  const yearNum = body.year
  const monthNum = body.month
  const paymentDate = body.payment_date
  
  // 查询所有活跃员工及其补贴配置（优化：一次性批量查询）
  const employees = await c.env.DB.prepare(`
    select 
      e.id,
      e.name,
      e.department_id,
      e.join_date,
      e.status,
      e.regular_date,
      e.birthday
    from employees e
    where e.active = 1
  `).all<any>()
  
  const employeeIds = (employees.results || []).map((emp: any) => emp.id)
  
  if (employeeIds.length === 0) {
    return c.json({ created: 0, ids: [] })
  }
  
  // 批量查询所有员工的补贴配置（优化：一次性查询）
  const placeholders = employeeIds.map(() => '?').join(',')
  const allAllowances = await c.env.DB.prepare(`
    select 
      ea.*,
      c.code as currency_code
    from employee_allowances ea
    left join currencies c on c.code = ea.currency_id
    where ea.employee_id in (${placeholders})
    order by ea.employee_id, ea.allowance_type, c.code
  `).bind(...employeeIds).all<any>()
  
  // 按员工ID分组补贴配置
  const allowancesByEmployee = new Map<string, any[]>()
  for (const allowance of (allAllowances.results || [])) {
    if (!allowancesByEmployee.has(allowance.employee_id)) {
      allowancesByEmployee.set(allowance.employee_id, [])
    }
    allowancesByEmployee.get(allowance.employee_id)!.push(allowance)
  }
  
  // 批量查询已存在的补贴发放记录（优化：一次性查询）
  const existingPayments = await c.env.DB.prepare(`
    select employee_id, year, month, allowance_type, currency_id
    from allowance_payments
    where employee_id in (${placeholders})
      and year = ? and month = ?
  `).bind(...employeeIds, yearNum, monthNum).all<any>()
  
  // 构建已存在记录的Set用于快速查找
  const existingSet = new Set<string>()
  for (const payment of (existingPayments.results || [])) {
    existingSet.add(`${payment.employee_id}:${payment.year}:${payment.month}:${payment.allowance_type}:${payment.currency_id}`)
  }
  
  const created = []
  const now = Date.now()
  const userId = c.get('userId') as string | undefined
  
  // 准备批量插入的语句
  const insertStatements: any[] = []
  
  for (const emp of (employees.results || [])) {
    const joinDate = new Date(emp.join_date + 'T00:00:00Z')
    const joinYear = joinDate.getFullYear()
    const joinMonth = joinDate.getMonth() + 1
    
    // 检查员工在该月是否在职
    if (joinYear > yearNum || (joinYear === yearNum && joinMonth > monthNum)) {
      continue // 还未入职
    }
    
    const allowances = allowancesByEmployee.get(emp.id) || []
    
    // 为每种补贴创建发放记录
    for (const allowance of allowances) {
      // 特殊处理：生日补贴只在生日月份生成
      if (allowance.allowance_type === 'birthday') {
        if (!emp.birthday) continue // 没有生日信息，跳过
        
        const birthday = new Date(emp.birthday + 'T00:00:00Z')
        const birthdayMonth = birthday.getMonth() + 1
        
        // 如果当前月份不是生日月份，跳过
        if (monthNum !== birthdayMonth) continue
      }
      
      // 检查是否已存在发放记录
      const key = `${emp.id}:${yearNum}:${monthNum}:${allowance.allowance_type}:${allowance.currency_id}`
      if (existingSet.has(key)) continue // 已存在，跳过
      
      // 创建补贴发放记录
      const id = uuid()
      insertStatements.push({
        id,
        employee_id: emp.id,
        year: yearNum,
        month: monthNum,
        allowance_type: allowance.allowance_type,
        currency_id: allowance.currency_id,
        amount_cents: allowance.amount_cents,
        payment_date: paymentDate,
        payment_method: 'cash',
        created_by: userId || 'system',
        created_at: now,
        updated_at: now
      })
      
      created.push(id)
    }
  }
  
  // 批量插入（优化：使用batch操作）
  if (insertStatements.length > 0) {
    const batch = insertStatements.map(stmt => 
      c.env.DB.prepare(`
        insert into allowance_payments(
          id, employee_id, year, month, allowance_type, currency_id, amount_cents,
          payment_date, payment_method, created_by, created_at, updated_at
        ) values(?,?,?,?,?,?,?,?,'cash',?,?,?)
      `).bind(
        stmt.id, stmt.employee_id, stmt.year, stmt.month, stmt.allowance_type, stmt.currency_id,
        stmt.amount_cents, stmt.payment_date, userId || 'system', stmt.created_at, stmt.updated_at
      )
    )
    
    await c.env.DB.batch(batch)
    
    // 记录审计日志
    for (const stmt of insertStatements) {
      logAuditAction(c, 'create', 'allowance_payment', stmt.id, JSON.stringify({
        employee_id: stmt.employee_id,
        year: stmt.year,
        month: stmt.month,
        allowance_type: stmt.allowance_type,
        currency_id: stmt.currency_id,
        amount_cents: stmt.amount_cents
      }))
    }
  }
  
  return c.json({ created: created.length, ids: created })
})

// 补贴发放管理 - 创建单个发放记录
allowancePaymentsRoutes.post('/allowance-payments', validateJson(createAllowancePaymentSchema), async (c) => {
  if (!(await requireRole(c, ['manager', 'finance']))) throw Errors.FORBIDDEN()
  const body = getValidatedData<z.infer<typeof createAllowancePaymentSchema>>(c)
  
  // 验证员工是否存在
  const emp = await c.env.DB.prepare('select id from employees where id=?').bind(body.employee_id).first<{ id: string }>()
  if (!emp) throw Errors.NOT_FOUND('员工')
  
  // 验证币种是否存在
  const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(body.currency_id).first<{ code: string }>()
  if (!currency) throw Errors.NOT_FOUND('币种')
  
  // 检查是否已存在
  const existing = await c.env.DB.prepare(
    'select id from allowance_payments where employee_id=? and year=? and month=? and allowance_type=? and currency_id=?'
  ).bind(body.employee_id, body.year, body.month, body.allowance_type, body.currency_id).first<{ id: string }>()
  
  if (existing) throw Errors.DUPLICATE('津贴支付记录')
  
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  const id = uuid()
  await c.env.DB.prepare(`
    insert into allowance_payments(
      id, employee_id, year, month, allowance_type, currency_id, amount_cents,
      payment_date, payment_method, voucher_url, memo, created_by, created_at, updated_at
    ) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.employee_id, body.year, body.month, body.allowance_type, body.currency_id,
    body.amount_cents, body.payment_date, body.payment_method || 'cash',
    body.voucher_url || null, body.memo || null, userId || 'system', now, now
  ).run()
  
  logAuditAction(c, 'create', 'allowance_payment', id, JSON.stringify(body))
  
  const created = await c.env.DB.prepare(`
    select 
      ap.*,
      e.name as employee_name,
      d.name as department_name,
      c.name as currency_name,
      u.name as created_by_name
    from allowance_payments ap
    left join employees e on e.id = ap.employee_id
    left join departments d on d.id = e.department_id
    left join currencies c on c.code = ap.currency_id
    left join users u on u.id = ap.created_by
    where ap.id=?
  `).bind(id).first()
  
  return c.json(created)
})

// 补贴发放管理 - 更新
allowancePaymentsRoutes.put('/allowance-payments/:id', validateJson(updateAllowancePaymentSchema), async (c) => {
  if (!(await requireRole(c, ['manager', 'finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = getValidatedData<z.infer<typeof updateAllowancePaymentSchema>>(c)
  
  const record = await c.env.DB.prepare('select * from allowance_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  const updates: string[] = []
  const binds: any[] = []
  
  if (body.amount_cents !== undefined) { updates.push('amount_cents=?'); binds.push(body.amount_cents) }
  if (body.payment_date !== undefined) { updates.push('payment_date=?'); binds.push(body.payment_date) }
  if (body.payment_method !== undefined) { updates.push('payment_method=?'); binds.push(body.payment_method) }
  if (body.voucher_url !== undefined) { updates.push('voucher_url=?'); binds.push(body.voucher_url || null) }
  if (body.memo !== undefined) { updates.push('memo=?'); binds.push(body.memo || null) }
  
  if (updates.length === 0) {
    const current = await c.env.DB.prepare(`
      select 
        ap.*,
        e.name as employee_name,
        d.name as department_name,
        c.name as currency_name,
        u.name as created_by_name
      from allowance_payments ap
      left join employees e on e.id = ap.employee_id
      left join departments d on d.id = e.department_id
      left join currencies c on c.code = ap.currency_id
      left join users u on u.id = ap.created_by
      where ap.id=?
    `).bind(id).first()
    return c.json(current)
  }
  
  updates.push('updated_at=?')
  binds.push(Date.now())
  binds.push(id)
  
  await c.env.DB.prepare(`update allowance_payments set ${updates.join(',')} where id=?`).bind(...binds).run()
  
  logAuditAction(c, 'update', 'allowance_payment', id, JSON.stringify(body))
  
  const updated = await c.env.DB.prepare(`
    select 
      ap.*,
      e.name as employee_name,
      d.name as department_name,
      c.name as currency_name,
      u.name as created_by_name
    from allowance_payments ap
    left join employees e on e.id = ap.employee_id
    left join departments d on d.id = e.department_id
    left join currencies c on c.code = ap.currency_id
    left join users u on u.id = ap.created_by
    where ap.id=?
  `).bind(id).first()
  
  return c.json(updated)
})

// 补贴发放管理 - 删除
allowancePaymentsRoutes.delete('/allowance-payments/:id', async (c) => {
  if (!(await requireRole(c, ['manager', 'finance']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare('select * from allowance_payments where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  await c.env.DB.prepare('delete from allowance_payments where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'allowance_payment', id, JSON.stringify({
    employee_id: record.employee_id,
    year: record.year,
    month: record.month,
    allowance_type: record.allowance_type
  }))
  
  return c.json({ ok: true })
})

