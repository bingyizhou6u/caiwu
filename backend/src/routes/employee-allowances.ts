import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { hasPermission } from '../utils/permissions.js'
import { logAuditAction } from '../utils/audit.js'
import { uuid } from '../utils/db.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { batchUpdateEmployeeAllowancesSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

export const employeeAllowancesRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 获取员工的补贴配置
employeeAllowancesRoutes.get('/employee-allowances', async (c) => {
  // 所有人都可以查看（通过数据权限过滤）
  
  const employeeId = c.req.query('employee_id')
  const allowanceType = c.req.query('allowance_type') // living, housing, transportation, meal
  
  if (!employeeId) throw Errors.VALIDATION_ERROR('employee_id参数必填')
  
  let sql = `
    select 
      ea.*,
      c.name as currency_name,
      e.name as employee_name
    from employee_allowances ea
    left join currencies c on c.code = ea.currency_id
    left join employees e on e.id = ea.employee_id
    where ea.employee_id = ?
  `
  const binds: any[] = [employeeId]
  
  if (allowanceType) {
    sql += ' and ea.allowance_type = ?'
    binds.push(allowanceType)
  }
  
  sql += ' order by ea.allowance_type, c.code'
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all()
  return c.json({ results: rows.results ?? [] })
})

// 批量更新员工的补贴配置
employeeAllowancesRoutes.put('/employee-allowances/batch', validateJson(batchUpdateEmployeeAllowancesSchema), async (c) => {
  // 只有有津贴创建权限的人可以修改
  if (!hasPermission(c, 'finance', 'allowance', 'create')) throw Errors.FORBIDDEN()
  
  const body = getValidatedData<z.infer<typeof batchUpdateEmployeeAllowancesSchema>>(c)
  
  // 验证员工是否存在
  const emp = await c.env.DB.prepare('select id from employees where id=?').bind(body.employee_id).first<{ id: string }>()
  if (!emp) throw Errors.NOT_FOUND('员工')
  
  const userId = c.get('userId') as string | undefined
  const now = Date.now()
  
  // 删除该员工该类型的所有补贴配置
  await c.env.DB.prepare(
    'delete from employee_allowances where employee_id=? and allowance_type=?'
  ).bind(body.employee_id, body.allowance_type).run()
  
  // 插入新的补贴配置
  const created = []
  for (const allowance of body.allowances) {
    if (!allowance.currency_id || allowance.amount_cents === undefined || allowance.amount_cents === null) {
      continue
    }
    
    // 验证币种是否存在
    const currency = await c.env.DB.prepare('select code from currencies where code=?').bind(allowance.currency_id).first<{ code: string }>()
    if (!currency) continue
    
    const id = uuid()
    await c.env.DB.prepare(`
      insert into employee_allowances(
        id, employee_id, allowance_type, currency_id, amount_cents, created_at, updated_at
      ) values(?,?,?,?,?,?,?)
    `).bind(id, body.employee_id, body.allowance_type, allowance.currency_id, allowance.amount_cents, now, now).run()
    
    created.push(id)
  }
  
  logAuditAction(c, 'update', 'employee_allowance', body.employee_id, JSON.stringify({
    employee_id: body.employee_id,
    allowance_type: body.allowance_type,
    allowances: body.allowances
  }))
  
  // 返回更新后的所有补贴配置
  const updated = await c.env.DB.prepare(`
    select 
      ea.*,
      c.name as currency_name,
      e.name as employee_name
    from employee_allowances ea
    left join currencies c on c.code = ea.currency_id
    left join employees e on e.id = ea.employee_id
    where ea.employee_id=? and ea.allowance_type=?
    order by c.code
  `).bind(body.employee_id, body.allowance_type).all()
  
  return c.json({ results: updated.results ?? [] })
})

// 删除员工的补贴配置
employeeAllowancesRoutes.delete('/employee-allowances/:id', async (c) => {
  // 只有有津贴更新权限的人可以删除
  if (!hasPermission(c, 'finance', 'allowance', 'update')) throw Errors.FORBIDDEN()
  
  const id = c.req.param('id')
  
  const record = await c.env.DB.prepare('select * from employee_allowances where id=?').bind(id).first<any>()
  if (!record) throw Errors.NOT_FOUND()
  
  await c.env.DB.prepare('delete from employee_allowances where id=?').bind(id).run()
  
  logAuditAction(c, 'delete', 'employee_allowance', id, JSON.stringify({
    employee_id: record.employee_id,
    allowance_type: record.allowance_type,
    currency_id: record.currency_id
  }))
  
  return c.json({ ok: true })
})

