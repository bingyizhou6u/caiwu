/**
 * Dashboard统计路由模块
 */

import { Hono } from 'hono'
import type { Env, AppVariables } from '../../types.js'
import { canRead } from '../../utils/permissions.js'
import { UserService } from '../../services/UserService.js'
import { Errors } from '../../utils/errors.js'

export const dashboardRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// Dashboard统计数据
dashboardRoutes.get('/stats', async (c) => {
  if (!canRead(c)) throw Errors.FORBIDDEN()

  const today = new Date().toISOString().slice(0, 10)
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const thisMonthEnd = today

  const role = c.get('userRole') as string | undefined
  const userId = c.get('userId') as string | undefined

  // 优化：如果需要权限过滤，先获取部门ID（避免重复查询）
  let deptId: string | null = null
  if (role !== 'manager' && role !== 'finance' && userId) {
    deptId = await new UserService(c.env.DB).getUserDepartmentId(userId)
  }

  // 今日收支统计
  let todaySql = `
    select 
      coalesce(sum(case when type='income' then amount_cents end), 0) as income_cents,
      coalesce(sum(case when type='expense' then amount_cents end), 0) as expense_cents,
      count(*) as count
    from cash_flows
    where biz_date=?
  `
  let todayBinds: any[] = [today]

  // 本月收支统计
  let monthSql = `
    select 
      coalesce(sum(case when type='income' then amount_cents end), 0) as income_cents,
      coalesce(sum(case when type='expense' then amount_cents end), 0) as expense_cents,
      count(*) as count
    from cash_flows
    where biz_date>=? and biz_date<=?
  `
  let monthBinds: any[] = [thisMonthStart, thisMonthEnd]

  // 应收应付统计
  let arApSql = `
    select 
      kind,
      count(*) as count,
      coalesce(sum(amount_cents), 0) as total_cents,
      coalesce(sum(case when status='open' then amount_cents end), 0) as open_cents
    from ar_ap_docs
    where issue_date>=?
    group by kind
  `
  let arApBinds: any[] = [thisMonthStart]

  // 最近交易记录（最近10条）
  let recentSql = `
    select f.*, a.name as account_name, a.currency as account_currency, c.name as category_name, d.name as department_name
    from cash_flows f
    left join accounts a on a.id=f.account_id
    left join categories c on c.id=f.category_id
    left join departments d on d.id=f.department_id
    order by f.created_at desc
    limit 10
  `
  let recentBinds: any[] = []

  // 应用数据权限过滤
  if (deptId) {
    todaySql += ' and (department_id=? or department_id is null)'
    todayBinds.push(deptId)
    monthSql += ' and (department_id=? or department_id is null)'
    monthBinds.push(deptId)
    arApSql += ' and (department_id=? or department_id is null)'
    arApBinds.push(deptId)
    recentSql = recentSql.replace('order by', 'where (f.department_id=? or f.department_id is null) order by')
    recentBinds.push(deptId)
  }

  // 优化：并行查询所有统计数据
  const [todayStats, monthStats, accounts, arApStats, borrowingBalance, recentFlows] = await Promise.all([
    c.env.DB.prepare(todaySql).bind(...todayBinds).first<any>(),
    c.env.DB.prepare(monthSql).bind(...monthBinds).first<any>(),
    c.env.DB.prepare('select count(*) as cnt from accounts where active=1').first<{ cnt: number }>(),
    c.env.DB.prepare(arApSql).bind(...arApBinds).all<any>(),
    c.env.DB.prepare(`
      select 
        count(distinct user_id) as borrower_count,
        coalesce(sum(amount_cents), 0) as total_borrowed_cents,
        coalesce((
          select sum(r.amount_cents)
          from repayments r
          where r.borrowing_id in (select id from borrowings)
        ), 0) as total_repaid_cents
      from borrowings
    `).first<any>(),
    c.env.DB.prepare(recentSql).bind(...recentBinds).all<any>()
  ])

  return c.json({
    today: {
      income_cents: todayStats?.income_cents || 0,
      expense_cents: todayStats?.expense_cents || 0,
      count: todayStats?.count || 0
    },
    month: {
      income_cents: monthStats?.income_cents || 0,
      expense_cents: monthStats?.expense_cents || 0,
      count: monthStats?.count || 0
    },
    accounts: {
      total: accounts?.cnt || 0
    },
    ar_ap: (arApStats.results || []).reduce((acc: any, r: any) => {
      acc[r.kind] = {
        count: r.count,
        total_cents: r.total_cents,
        open_cents: r.open_cents
      }
      return acc
    }, {}),
    borrowings: {
      borrower_count: borrowingBalance?.borrower_count || 0,
      total_borrowed_cents: borrowingBalance?.total_borrowed_cents || 0,
      total_repaid_cents: borrowingBalance?.total_repaid_cents || 0,
      balance_cents: (borrowingBalance?.total_borrowed_cents || 0) - (borrowingBalance?.total_repaid_cents || 0)
    },
    recent_flows: recentFlows.results || []
  })
})

