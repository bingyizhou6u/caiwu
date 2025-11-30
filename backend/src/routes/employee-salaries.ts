import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { createEmployeeSalarySchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

export const employeeSalariesRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取员工的多币种底薪
employeeSalariesRoutes.get('/employee-salaries', async (c) => {
  // 所有人都可以查看（通过数据权限过滤）
  
  const employeeId = c.req.query('employee_id')
  const salaryType = c.req.query('salary_type') // probation or regular
  
  if (!employeeId) throw Errors.VALIDATION_ERROR('employee_id参数必填')
  
  let sql = `
    select 
      es.*,
      c.name as currency_name,
      e.name as employee_name
    from employee_salaries es
    left join currencies c on c.code = es.currency_id
    left join employees e on e.id = es.employee_id
    where es.employee_id = ?
  `
  const binds: any[] = [employeeId]
  
  if (salaryType) {
    sql += ' and es.salary_type = ?'
    binds.push(salaryType)
  }
  
  sql += ' order by es.salary_type, c.code'
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 创建或更新员工的多币种底薪
employeeSalariesRoutes.post('/employee-salaries', validateJson(createEmployeeSalarySchema), async (c) => {
  if (!hasPermission(c, 'hr', 'salary', 'create')) throw Errors.FORBIDDEN()
  
  const body = getValidatedData<z.infer<typeof createEmployeeSalarySchema>>(c)
  
  // 验证员工是否存在
  const emp = await c.env.DB.prepare('select id from employees where id=?').bind(body.employee_id).first<{ id: string }>()
  if (!emp) throw Errors.NOT_FOUND('员工')
  
  // 验证币种是否存在
  const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(body.currency_id).first<{ code: string }>()
  if (!currency) throw Errors.NOT_FOUND('币种')
  
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 检查是否已存在
  const existing = await c.env.DB.prepare(
    'select id from employee_salaries where employee_id=? and salary_type=? and currency_id=?'
  ).bind(body.employee_id, body.salary_type, body.currency_id).first<{ id: string }>()
  
  if (existing) {
    // 更新现有记录
    await c.env.DB.prepare(`
      update employee_salaries 
      set amount_cents=?, updated_at=?
      where id=?
    `).bind(body.amount_cents, now, existing.id).run()
    
    logAuditAction(c, 'update', 'employee_salary', existing.id, JSON.stringify({
      employee_id: body.employee_id,
      salary_type: body.salary_type,
      currency_id: body.currency_id,
      amount_cents: body.amount_cents
    }))
    
    const updated = await c.env.DB.prepare(`
      select 
        es.*,
        c.name as currency_name,
        e.name as employee_name
      from employee_salaries es
      left join currencies c on c.code = es.currency_id
      left join employees e on e.id = es.employee_id
      where es.id=?
    `).bind(existing.id).first()
    
    return c.json(updated)
  } else {
    // 创建新记录
    const id = uuid()
    await c.env.DB.prepare(`
      insert into employee_salaries(
        id, employee_id, salary_type, currency_id, amount_cents, created_at, updated_at
      ) values(?,?,?,?,?,?,?)
    `).bind(id, body.employee_id, body.salary_type, body.currency_id, body.amount_cents, now, now).run()
    
    logAuditAction(c, 'create', 'employee_salary', id, JSON.stringify({
      employee_id: body.employee_id,
      salary_type: body.salary_type,
      currency_id: body.currency_id,
      amount_cents: body.amount_cents
    }))
    
    const created = await c.env.DB.prepare(`
      select 
        es.*,
        c.name as currency_name,
        e.name as employee_name
      from employee_salaries es
      left join currencies c on c.code = es.currency_id
      left join employees e on e.id = es.employee_id
      where es.id=?
    `).bind(id).first()
    
    return c.json(created)
  }
})

// 批量更新员工的多币种底薪
employeeSalariesRoutes.put('/employee-salaries/batch', async (c) => {
  if (!hasPermission(c, 'hr', 'salary', 'update')) throw Errors.FORBIDDEN()
  
  const body = await c.req.json<{
    employee_id: string
    salary_type: 'probation' | 'regular'
    salaries: Array<{ currency_id: string, amount_cents: number }>
  }>()
  
  if (!body.employee_id) throw Errors.VALIDATION_ERROR('employee_id参数必填')
  if (!body.salary_type) throw Errors.VALIDATION_ERROR('salary_type参数必填')
  if (!Array.isArray(body.salaries)) throw Errors.VALIDATION_ERROR('salaries必须是数组')
  
  // 验证员工是否存在
  const emp = await c.env.DB.prepare('select id from employees where id=?').bind(body.employee_id).first<{ id: string }>()
  if (!emp) throw Errors.NOT_FOUND('员工')
  
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 删除该员工该类型的所有底薪配置
  await c.env.DB.prepare(
    'delete from employee_salaries where employee_id=? and salary_type=?'
  ).bind(body.employee_id, body.salary_type).run()
  
  // 插入新的底薪配置
  const created = []
  for (const salary of body.salaries) {
    if (!salary.currency_id || salary.amount_cents === undefined || salary.amount_cents === null) {
      continue
    }
    
    // 验证币种是否存在
    const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(salary.currency_id).first<{ code: string }>()
    if (!currency) continue
    
    const id = uuid()
    await c.env.DB.prepare(`
      insert into employee_salaries(
        id, employee_id, salary_type, currency_id, amount_cents, created_at, updated_at
      ) values(?,?,?,?,?,?,?)
    `).bind(id, body.employee_id, body.salary_type, salary.currency_id, salary.amount_cents, now, now).run()
    
    created.push(id)
  }
  
  logAuditAction(c, 'update', 'employee_salary', body.employee_id, JSON.stringify({
    employee_id: body.employee_id,
    salary_type: body.salary_type,
    salaries: body.salaries
  }))
  
  // 返回更新后的所有底薪配置
  const updated = await c.env.DB.prepare(`
    select 
      es.*,
      c.name as currency_name,
      e.name as employee_name
    from employee_salaries es
    left join currencies c on c.code = es.currency_id
    left join employees e on e.id = es.employee_id
    where es.employee_id=? and es.salary_type=?
    order by c.code
  `).bind(body.employee_id, body.salary_type).all()
  
  return c.json({ results: updated.results ?? [] })
})

// 删除员工的多币种底薪
employeeSalariesRoutes.delete('/employee-salaries/:id', async (c) => {
  if (!hasPermission(c, 'hr', 'salary', 'update')) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare('select * from employee_salaries where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND('员工底薪记录')
  
  await c.env.DB.prepare('delete from employee_salaries where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'employee_salary', id, JSON.stringify({
    employee_id: record.employee_id,
    salary_type: record.salary_type,
    currency_id: record.currency_id
  }))
  
  return c.json({ ok: true })
})

