import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, AppVariables } from './types.js'
import { createAuthMiddleware } from './middleware.js'
import { errorHandler } from './utils/errors.js'
import { authRoutes } from './routes/auth.js'
import { master_dataRoutes } from './routes/master-data.js'
import { flowsRoutes } from './routes/flows.js'
import { ar_apRoutes } from './routes/ar-ap.js'
import { reportsRoutes } from './routes/reports.js'
import { importRoutes } from './routes/import.js'
import { employeesRoutes } from './routes/employees.js'
import { borrowingsRoutes } from './routes/borrowings.js'
import { ip_whitelistRoutes } from './routes/ip-whitelist.js'
import { auditRoutes } from './routes/audit.js'
import { salaryPaymentsRoutes } from './routes/salary-payments.js'
import { fixedAssetsRoutes } from './routes/fixed-assets.js'
import { siteBillsRoutes } from './routes/site-bills.js'
import { accountTransfersRoutes } from './routes/account-transfers.js'
import { systemConfigRoutes } from './routes/system-config.js'
import { employeeSalariesRoutes } from './routes/employee-salaries.js'
import { employeeAllowancesRoutes } from './routes/employee-allowances.js'
import { allowancePaymentsRoutes } from './routes/allowance-payments.js'
import { rentalRoutes } from './routes/rental.js'
import { positionPermissionsRoutes } from './routes/position-permissions.js'
import siteConfigRoutes from './routes/site-config.js'
import { sessionsRoutes } from './routes/sessions.js'
import { myRoutes } from './routes/my.js'
import { approvalsRoutes } from './routes/approvals.js'

const app = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 全局错误处理（必须在最前面）
app.use('*', errorHandler)

app.use('*', cors({
  origin: (origin) => {
    // 允许的前端域名
    if (!origin) return null
    if (origin.includes('.pages.dev') || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('cloudflarets.com')) {
      return origin
    }
    return null
  },
  credentials: true
}))

app.get('/', (c) => c.json({ ok: true, name: 'caiwu-backend' }))

// 健康检查和版本信息（不需要认证）
app.get('/api/health', async (c) => {
  try {
    // 优化：使用最简单最快的查询，添加超时控制
    const r = await Promise.race([
      c.env.DB.prepare('select 1 as ok').first<{ ok: number }>(),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 2000)
      )
    ]).catch(() => null)
    
    return c.json({ db: r ? r.ok === 1 : false })
  } catch (error: any) {
    // 如果查询失败，返回数据库不可用
    return c.json({ db: false })
  }
})

app.get('/api/version', (c) => c.json({ version: 'currencies-v1' }))

// 注册中间件
app.use('/api/*', createAuthMiddleware())

// 导入并注册各个路由模块
app.route('/api', authRoutes)
app.route('/api', master_dataRoutes)
app.route('/api', flowsRoutes)
app.route('/api', ar_apRoutes)
app.route('/api', reportsRoutes)
app.route('/api', importRoutes)
app.route('/api', employeesRoutes)
app.route('/api', borrowingsRoutes)
app.route('/api', ip_whitelistRoutes)
app.route('/api', auditRoutes)
app.route('/api', salaryPaymentsRoutes)
app.route('/api', fixedAssetsRoutes)
app.route('/api', siteBillsRoutes)
app.route('/api', accountTransfersRoutes)
app.route('/api', systemConfigRoutes)
app.route('/api', employeeSalariesRoutes)
app.route('/api', employeeAllowancesRoutes)
app.route('/api', allowancePaymentsRoutes)
app.route('/api', rentalRoutes)
app.route('/api', positionPermissionsRoutes)
app.route('/api', siteConfigRoutes)
app.route('/api', sessionsRoutes)
app.route('/api', myRoutes)
app.route('/api', approvalsRoutes)

export default app
