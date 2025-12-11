// Framework imports
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

// Type imports
import type { Env, AppVariables } from './types.js'

// Middleware imports
import { createAuthMiddleware } from './middleware.js'
import { createIPWhitelistMiddleware } from './middleware/ipWhitelist.js'
import { di } from './middleware/di.js'

// Utility imports
import { errorHandler } from './utils/errors.js'

// Route imports
import { authRoutes } from './routes/auth.js'
import { master_dataRoutes } from './routes/master-data.js'
import { flowsRoutes } from './routes/flows.js'
import { ar_apRoutes } from './routes/ar-ap.js'
import reportsRoutes from './routes/reports.js'
import { importRoutes } from './routes/import.js'
import { employeesRoutes } from './routes/employees.js'
import { borrowingsRoutes } from './routes/borrowings.js'
import { ipWhitelistRoutes } from './routes/ip-whitelist.js'
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
import { myRoutes } from './routes/my.js'
import { approvalsRoutes } from './routes/approvals.js'
import { employeesLeavesRoutes } from './routes/employee-leaves.js'
import { expenseReimbursementsRoutes } from './routes/expense-reimbursements.js'

// App initialization
const app = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// 全局错误处理（必须在最前面）
app.onError(errorHandler)





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
// 注册中间件
app.use('/api/*', createIPWhitelistMiddleware())
app.use('/api/*', createAuthMiddleware())
app.use('/api/*', di)




// 导入并注册各个路由模块
app.route('/api', authRoutes)
app.route('/api', master_dataRoutes)
app.route('/api', flowsRoutes)
app.route('/api', ar_apRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api', importRoutes)
app.route('/api', employeesRoutes)
app.route('/api', borrowingsRoutes)
app.route('/api', ipWhitelistRoutes)
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

app.route('/api', myRoutes)
app.route('/api', approvalsRoutes)
app.route('/api/employee-leaves', employeesLeavesRoutes)
app.route('/api/expense-reimbursements', expenseReimbursementsRoutes)

// OpenAPI 文档配置
app.doc('/api/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Caiwu API',
  },
})

// Swagger UI
app.get('/api/ui', swaggerUI({ url: '/api/doc' }))



export default app
