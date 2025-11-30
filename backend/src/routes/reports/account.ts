/**
 * 账户和借支报表路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { getUserPosition, getUserEmployee, getDataAccessFilter } from '../../utils/permissions.js'
import { UserService } from '../../services/UserService.js'
import { Errors } from '../../utils/errors.js'
import { validateQuery, getValidatedQuery, validateParam, getValidatedParams } from '../../utils/validator.js'
import { dateRangeQuerySchema, singleDateQuerySchema, dateSchema, uuidSchema } from '../../schemas/common.schema.js'
import { z } from 'zod'

export const accountReportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 账户余额报表
accountReportsRoutes.get('/account-balance', validateQuery(singleDateQuerySchema), async (c) => {
  const position = getUserPosition(c)
  if (!position) throw Errors.FORBIDDEN()
  if (position.level > 2) throw Errors.FORBIDDEN('只有总部和项目人员可以查看报表')

  const query = getValidatedQuery<z.infer<typeof singleDateQuerySchema>>(c)
  const asOf = query.as_of

  const accounts = await c.env.DB.prepare('select id, name, type, currency, account_number from accounts where active=1 order by name').all<any>()

  // 优化：批量查询所有账户的余额数据，避免 N+1 查询
  const accountIds = (accounts.results || []).map((acc: any) => acc.id)
  
  if (accountIds.length === 0) {
    return c.json({ rows: [], as_of: asOf })
  }
  
  const placeholders = accountIds.map(() => '?').join(',')
  
  // 批量查询期初余额
  const openingBalances = await c.env.DB.prepare(`
    select ref_id as account_id, coalesce(sum(amount_cents), 0) as ob
    from opening_balances
    where type='account' and ref_id in (${placeholders})
    group by ref_id
  `).bind(...accountIds).all<{ account_id: string, ob: number }>()
  
  // 批量查询历史交易（asOf之前）
  const priorFlows = await c.env.DB.prepare(`
    select 
      account_id,
      coalesce(sum(case when type='income' then amount_cents when type='expense' then -amount_cents else 0 end), 0) as prior_net
    from cash_flows
    where account_id in (${placeholders}) and biz_date < ?
    group by account_id
  `).bind(...accountIds, asOf).all<{ account_id: string, prior_net: number }>()
  
  // 批量查询当天交易
  const periodFlows = await c.env.DB.prepare(`
    select 
      account_id,
      coalesce(sum(case when type='income' then amount_cents else 0 end), 0) as income_cents,
      coalesce(sum(case when type='expense' then amount_cents else 0 end), 0) as expense_cents
    from cash_flows
    where account_id in (${placeholders}) and biz_date = ?
    group by account_id
  `).bind(...accountIds, asOf).all<{ account_id: string, income_cents: number, expense_cents: number }>()
  
  // 构建映射表便于快速查找
  const obMap = new Map((openingBalances.results || []).map(r => [r.account_id, r.ob]))
  const priorMap = new Map((priorFlows.results || []).map(r => [r.account_id, r.prior_net]))
  const periodMap = new Map((periodFlows.results || []).map(r => [r.account_id, { income_cents: r.income_cents, expense_cents: r.expense_cents }]))
  
  // 组装结果
  const rows = (accounts.results || []).map((acc: any) => {
    const ob = obMap.get(acc.id) || 0
    const prior = priorMap.get(acc.id) || 0
    const period = periodMap.get(acc.id) || { income_cents: 0, expense_cents: 0 }
    
    const opening = ob + prior
    const closing = opening + period.income_cents - period.expense_cents
    
    return {
      account_id: acc.id,
      account_name: acc.name,
      account_type: acc.type,
      currency: acc.currency,
      account_number: acc.account_number,
      opening_cents: opening,
      income_cents: period.income_cents,
      expense_cents: period.expense_cents,
      closing_cents: closing
    }
  })

  return c.json({ rows, as_of: asOf })
})

// 借支汇总报表（日期参数可选）
const borrowingSummaryQuerySchema = z.object({
  start: dateSchema.optional(),
  end: dateSchema.optional(),
})
accountReportsRoutes.get('/borrowing-summary', validateQuery(borrowingSummaryQuerySchema), async (c) => {
  const position = getUserPosition(c)
  if (!position) throw Errors.FORBIDDEN()
  if (position.level > 2) throw Errors.FORBIDDEN('只有总部和项目人员可以查看报表')

  const query = getValidatedQuery<z.infer<typeof borrowingSummaryQuerySchema>>(c)
  const start = query.start
  const end = query.end

  // 优化：使用 LEFT JOIN 替代子查询，减少查询复杂度
  let sql: string
  let binds: any[] = []
  
  if (start && end) {
    sql = `
      select 
        b.user_id,
        e.name as user_name,
        coalesce(sum(b.amount_cents), 0) as borrowed_cents,
        coalesce(sum(r.amount_cents), 0) as repaid_cents
      from borrowings b
      left join users u on u.id = b.user_id
      left join employees e on e.email = u.email
      left join repayments r on r.borrowing_id = b.id
      where b.created_at >= ? and b.created_at <= ?
      group by b.user_id, e.name
    `
    binds = [start, end]
  } else {
    sql = `
      select 
        b.user_id,
        e.name as user_name,
        coalesce(sum(b.amount_cents), 0) as borrowed_cents,
        coalesce(sum(r.amount_cents), 0) as repaid_cents
      from borrowings b
      left join users u on u.id = b.user_id
      left join employees e on e.email = u.email
      left join repayments r on r.borrowing_id = b.id
      group by b.user_id, e.name
    `
  }

  const { where, binds: scopeBinds } = getDataAccessFilter(c, 'u')
  if (where !== '1=1') {
    sql += ` and ${where}`
    binds.push(...scopeBinds)
  }
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()

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
  const position = getUserPosition(c)
  if (!position) throw Errors.FORBIDDEN()
  if (position.level > 2) throw Errors.FORBIDDEN('只有总部和项目人员可以查看报表')

  const params = getValidatedParams<z.infer<typeof userIdParamSchema>>(c)
  const userId = params.user_id
  const query = getValidatedQuery<z.infer<typeof optionalDateRangeSchema>>(c)
  const start = query.start
  const end = query.end

  let sql = `
    select b.*, e.name as user_name
    from borrowings b
    left join users u on u.id=b.user_id
    left join employees e on e.email = u.email
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
  const position = getUserPosition(c)
  if (!position) throw Errors.FORBIDDEN()
  if (position.level > 2) throw Errors.FORBIDDEN('只有总部和项目人员可以查看报表')

  const query = getValidatedQuery<z.infer<typeof newSiteRevenueQuerySchema>>(c)
  const start = query.start
  const end = query.end
  const days = query.days ?? 30

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
  const employee = getUserEmployee(c)
  if (position && position.level > 1 && employee?.department_id) {
    // 项目级别，根据部门过滤
    sql += ' and s.department_id=?'
    binds.push(employee.department_id)
  }

  sql += ' group by s.id, s.name, s.created_at order by s.created_at desc'
  const rows = await c.env.DB.prepare(sql).bind(...binds).all<any>()

  const mapped = (rows.results ?? []).map((r: any) => ({
    ...r,
    net_cents: (r.income_cents || 0) - (r.expense_cents || 0)
  }))

  return c.json({ rows: mapped })
})

