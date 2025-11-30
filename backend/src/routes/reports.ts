import { Hono } from 'hono'
import type { Env, AppVariables } from '../types.js'
import { uuid } from '../utils/db.js'
import { SystemService } from '../services/SystemService.js'
import { dashboardRoutes } from './reports/dashboard.js'
import { cashFlowReportsRoutes } from './reports/cash-flow.js'
import { arApReportsRoutes } from './reports/ar-ap.js'
import { expenseReportsRoutes } from './reports/expense.js'
import { accountReportsRoutes } from './reports/account.js'
import { salaryReportsRoutes } from './reports/salary.js'
import { annualLeaveReportRoutes } from './reports/annual-leave.js'

export const reportsRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 挂载子模块路由
reportsRoutes.route('/dashboard', dashboardRoutes)
reportsRoutes.route('/reports', cashFlowReportsRoutes)
reportsRoutes.route('/reports', arApReportsRoutes)
reportsRoutes.route('/reports', expenseReportsRoutes)
reportsRoutes.route('/reports', accountReportsRoutes)
reportsRoutes.route('/reports', salaryReportsRoutes)
reportsRoutes.route('/reports', annualLeaveReportRoutes)

// Health check and version are handled in index.ts

// Initialize minimal master data if empty (idempotent)
reportsRoutes.post('/init-if-empty', async (c) => {
  const hq = await c.env.DB.prepare('select count(1) as n from headquarters').first<{ n: number }>()
  const created: Record<string, string> = {}
  if (!hq || hq.n === 0) {
    const hqId = uuid()
    await c.env.DB.prepare('insert into headquarters(id,name,active) values(?,?,1)')
      .bind(hqId, '总部').run()
    created.hqId = hqId

    // 不创建默认项目和默认站点，账务如果没有明确指定项目则归属总部（department_id=null）

    const accId = uuid()
    await c.env.DB.prepare('insert into accounts(id,name,type,currency,opening_cents,active) values(?,?,?,?,0,1)')
      .bind(accId, '现金', 'cash', 'CNY').run()
    created.accountId = accId

    const catIn = uuid()
    await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,NULL)')
      .bind(catIn, '收入-其他', 'income').run()
    created.categoryIncomeId = catIn

    const catOut = uuid()
    await c.env.DB.prepare('insert into categories(id,name,kind,parent_id) values(?,?,?,NULL)')
      .bind(catOut, '支出-其他', 'expense').run()
    created.categoryExpenseId = catOut
  }
  // 已移除默认admin创建逻辑
  // 系统初始化后，必须通过员工管理创建第一个管理员账号
  const systemService = new SystemService(c.env.DB)
  await systemService.ensureDefaultCurrencies()
  return c.json({ created })
})
