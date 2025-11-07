/**
 * 支出报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead, canViewReports, applyDataScope } from '../../utils/permissions.js'
import { Errors } from '../../utils/errors.js'
import { validateQuery, getValidatedQuery } from '../../utils/validator.js'
import { dateRangeQuerySchema } from '../../schemas/common.schema.js'
import { uuidSchema } from '../../schemas/common.schema.js'
import type { z } from 'zod'

export const expenseReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 支出汇总报表
expenseReportsRoutes.get('/expense-summary', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  let sql = `
    select 
      c.id as category_id,
      c.name as category_name,
      c.kind,
      coalesce(sum(f.amount_cents),0) as total_cents,
      count(*) as count
    from categories c
    left join cash_flows f on f.category_id=c.id and f.type='expense' and f.biz_date>=? and f.biz_date<=?
    where c.kind='expense'
  `
  let binds: any[] = [start, end]
  
  const scoped = await applyDataScope(c, sql, binds)
  sql = scoped.sql + ' group by c.id, c.name, c.kind order by total_cents desc'
  binds = scoped.binds
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  return c.json({ rows: rows.results ?? [] })
})

// 支出明细报表
const expenseDetailQuerySchema = dateRangeQuerySchema.extend({
  category_id: uuidSchema.optional(),
})
expenseReportsRoutes.get('/expense-detail', validateQuery(expenseDetailQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof expenseDetailQuerySchema>>(c)
  const start = query.start
  const end = query.end
  const categoryId = query.category_id
  
  let sql = `
    select 
      f.*,
      a.name as account_name,
      a.currency as account_currency,
      c.name as category_name,
      d.name as department_name,
      s.name as site_name
    from cash_flows f
    left join accounts a on a.id=f.account_id
    left join categories c on c.id=f.category_id
    left join departments d on d.id=f.department_id
    left join sites s on s.id=f.site_id
    where f.type='expense' and f.biz_date>=? and f.biz_date<=?
  `
  let binds: any[] = [start, end]
  
  if (categoryId) {
    sql += ' and f.category_id=?'
    binds.push(categoryId)
  }
  
  const scoped = await applyDataScope(c, sql, binds)
  sql = scoped.sql + ' order by f.biz_date desc, f.created_at desc'
  binds = scoped.binds
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  return c.json({ rows: rows.results ?? [] })
})

