/**
 * 账户和借支报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead, canViewReports, applyDataScope } from '../../utils/permissions.js'
import { getUserDepartmentId } from '../../utils/db.js'
import { Errors } from '../../utils/errors.js'
import { validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../../utils/validator.js'
import { dateRangeQuerySchema, singleDateQuerySchema, dateSchema, uuidSchema } from '../../schemas/common.schema.js'
import { z } from 'zod'

export const accountReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 账户余额报表
accountReportsRoutes.get('/account-balance', validateQuery(singleDateQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof singleDateQuerySchema>>(c)
  const asOf = query.as_of
  
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
      currency: acc.currency,
      account_number: acc.account_number,
      opening_cents: opening,
      income_cents: period?.income_cents ?? 0,
      expense_cents: period?.expense_cents ?? 0,
      closing_cents: closing
    })
  }
  
  return c.json({ rows, as_of: asOf })
})

// 借支汇总报表
accountReportsRoutes.get('/borrowing-summary', validateQuery(dateRangeQuerySchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const query = getValidatedQuery<z.infer<typeof dateRangeQuerySchema>>(c)
  const start = query.start
  const end = query.end
  
  let sql = `
    select 
      b.user_id,
      u.name as user_name,
      coalesce(sum(b.amount_cents),0) as borrowed_cents,
      coalesce((
        select sum(r.amount_cents)
        from repayments r
        where r.borrowing_id=b.id
      ),0) as repaid_cents
    from borrowings b
    left join users u on u.id=b.user_id
    where b.created_at>=? and b.created_at<=?
    group by b.user_id, u.name
  `
  let binds: any[] = [start, end]
  
  const scoped = await applyDataScope(c, sql, binds)
  const rows = await c.env.DB.prepare(scoped.sql).bind(...scoped.binds).all<any>()
  
  const mapped = (rows.results ?? []).map((r: any) => ({
    ...r,
    balance_cents: (r.borrowed_cents || 0) - (r.repaid_cents || 0)
  }))
  
  return c.json({ rows: mapped })
})

// 借支明细报表
const userIdParamSchema = z.object({
  user_id: uuidSchema,
})
const optionalDateRangeSchema = z.object({
  start: dateSchema.optional(),
  end: dateSchema.optional(),
})
accountReportsRoutes.get('/borrowing-detail/:user_id', validateParam(userIdParamSchema), validateQuery(optionalDateRangeSchema), async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()
  if (!(await canViewReports(c))) throw Errors.FORBIDDEN('只有总部人员可以查看报表')
  
  const params = getValidatedParams<z.infer<typeof userIdParamSchema>>(c)
  const userId = params.user_id
  const query = getValidatedQuery<z.infer<typeof optionalDateRangeSchema>>(c)
  const start = query.start
  const end = query.end
  
  let sql = `
    select b.*, u.name as user_name
    from borrowings b
    left join users u on u.id=b.user_id
    where b.user_id=?
  `
  let binds: any[] = [userId]
  
  if (start && end) {
    sql += ' and b.created_at>=? and b.created_at<=?'
    binds.push(start, end)
  }
  
  sql += ' order by b.created_at desc'
  
  const borrowings = await c.env.DB.prepare(sql).bind(...binds).all<any>()
  
  // 获取还款记录
  const borrowingIds = (borrowings.results || []).map((b: any) => b.id)
  let repayments: any[] = []
  
  if (borrowingIds.length > 0) {
    const placeholders = borrowingIds.map(() => '?').join(',')
    const repaymentRows = await c.env.DB.prepare(`
      select r.* from repayments r
      where r.borrowing_id in (${placeholders})
      order by r.created_at desc
    `).bind(...borrowingIds).all<any>()
    repayments = repaymentRows.results || []
  }
  
  return c.json({
    borrowings: borrowings.results || [],
    repayments
  })
})

// 新站点收入报表
const newSiteRevenueQuerySchema = dateRangeQuerySchema.extend({
  days: z.number().int().positive().optional(),
})
accountReportsRoutes.get('/new-site-revenue', validateQuery(newSiteRevenueQuerySchema), async (c) => {
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
  
  const mapped = (rows.results ?? []).map((r: any) => ({
    ...r,
    net_cents: (r.income_cents || 0) - (r.expense_cents || 0)
  }))
  
  return c.json({ rows: mapped })
})

