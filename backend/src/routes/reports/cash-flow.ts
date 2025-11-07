/**
 * 现金流报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead, canViewReports, applyDataScope } from '../../utils/permissions.js'
import { getUserDepartmentId } from '../../utils/db.js'
import { Errors } from '../../utils/errors.js'
import { validateQuery, getValidatedQuery } from '../../utils/validator.js'
import { dateRangeQuerySchema } from '../../schemas/common.schema.js'
import type { z } from 'zod'

export const cashFlowReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 部门现金流报表
cashFlowReportsRoutes.get('/department-cash', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  let sql = `
    select 
      d.id as department_id,
      d.name as department_name,
      coalesce(sum(case when f.type='income' then f.amount_cents end),0) as income_cents,
      coalesce(sum(case when f.type='expense' then f.amount_cents end),0) as expense_cents,
      count(distinct case when f.type='income' then f.id end) as income_count,
      count(distinct case when f.type='expense' then f.id end) as expense_count
    from departments d
    left join cash_flows f on f.department_id=d.id and f.biz_date>=? and f.biz_date<=?
    where d.active=1
  `
  let binds: any[] = [start, end]
  
  const scoped = await applyDataScope(c, sql, binds)
  sql = scoped.sql + ' group by d.id, d.name order by d.name'
  binds = scoped.binds
  
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  const mapped = (rows.results ?? []).map((r: any) => ({
    ...r,
    net_cents: (r.income_cents || 0) - (r.expense_cents || 0)
  }))
  
  return c.json({ rows: mapped })
})

// 站点增长报表
cashFlowReportsRoutes.get('/site-growth', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  const startDate = new Date(start + 'T00:00:00Z')
  const endDate = new Date(end + 'T00:00:00Z')
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
  const prevEnd = new Date(startDate.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000)
  const prevStartStr = prevStart.toISOString().slice(0, 10)
  const prevEndStr = prevEnd.toISOString().slice(0, 10)
  
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
  
  const prevMap = new Map((prev.results ?? []).map((r: any) => [r.site_id, r.income_cents || 0]))
  const rows = (cur.results ?? []).map((r: any) => {
    const net = (r.income_cents || 0) - (r.expense_cents || 0)
    const prevIncome = prevMap.get(r.site_id) || 0
    const growth_rate = prevIncome === 0 ? (r.income_cents > 0 ? 1 : 0) : (r.income_cents - prevIncome) / prevIncome
    return { ...r, net_cents: net, prev_income_cents: prevIncome, growth_rate }
  })
  
  return c.json({ rows, prev_range: { start: prevStartStr, end: prevEndStr } })
})

