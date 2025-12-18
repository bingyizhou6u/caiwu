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
import { createRequestIdMiddleware } from './middleware/requestId.js'
import { securityHeaders } from './middleware/security.js'
import { apiRateLimitByIP } from './middleware/rateLimit.js'
import { performanceMonitor } from './middleware/performance.js'

// Utility imports
import { errorHandlerV2 } from './utils/errors.js'
import { Logger } from './utils/logger.js'
import { apiSuccess, jsonResponse } from './utils/response.js'
import { createDb } from './db/index.js'
import { DepartmentService } from './services/DepartmentService.js'
import { AuditService } from './services/AuditService.js'

// Route imports (V2 only)
import { authRoutes as authRoutesV2 } from './routes/v2/auth.js'
import { masterDataRoutes as masterDataRoutesV2 } from './routes/v2/master-data.js'
import { flowsRoutes as flowsRoutesV2 } from './routes/v2/flows.js'
import { arApRoutes as arApRoutesV2 } from './routes/v2/ar-ap.js'
import reportsRoutesV2 from './routes/v2/reports.js'
import { importRoutes as importRoutesV2 } from './routes/v2/import.js'
import { employeesRoutes as employeesRoutesV2 } from './routes/v2/employees.js'
import { borrowingsRoutes as borrowingsRoutesV2 } from './routes/v2/borrowings.js'
import { ipWhitelistRoutes as ipWhitelistRoutesV2 } from './routes/v2/ip-whitelist.js'
import { auditRoutes as auditRoutesV2 } from './routes/v2/audit.js'
import { salaryPaymentsRoutes as salaryPaymentsRoutesV2 } from './routes/v2/salary-payments.js'
import { fixedAssetsRoutes as fixedAssetsRoutesV2 } from './routes/v2/fixed-assets.js'
import { siteBillsRoutes as siteBillsRoutesV2 } from './routes/v2/site-bills.js'
import { accountTransfersRoutes as accountTransfersRoutesV2 } from './routes/v2/account-transfers.js'
import { systemConfigRoutes as systemConfigRoutesV2 } from './routes/v2/system-config.js'
import { employeeSalariesRoutes as employeeSalariesRoutesV2 } from './routes/v2/employee-salaries.js'
import { employeeAllowancesRoutes as employeeAllowancesRoutesV2 } from './routes/v2/employee-allowances.js'
import { allowancePaymentsRoutes as allowancePaymentsRoutesV2 } from './routes/v2/allowance-payments.js'
import { rentalRoutes as rentalRoutesV2 } from './routes/v2/rental.js'
import { positionPermissionsRoutes as positionPermissionsRoutesV2 } from './routes/v2/position-permissions.js'
import { myRoutes as myRoutesV2 } from './routes/v2/my.js'
import { approvalsRoutes as approvalsRoutesV2 } from './routes/v2/approvals.js'
import { employeesLeavesRoutes as employeesLeavesRoutesV2 } from './routes/v2/employee-leaves.js'
import { expenseReimbursementsRoutes as expenseReimbursementsRoutesV2 } from './routes/v2/expense-reimbursements.js'

// App initialization
const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Global middleware
app.use('*', createRequestIdMiddleware())
app.use('*', securityHeaders()) // 安全响应头
app.use('*', performanceMonitor()) // 性能监控
app.use(
  '*',
  cors({
    origin: origin => {
      // 允许的前端域名
      if (!origin) { return null }
      if (
        origin.includes('.pages.dev') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('cloudflarets.com')
      ) {
        return origin
      }
      return null
    },
    credentials: true,
  })
)
// 通用 API 速率限制（基于 IP）
app.use('/api/*', apiRateLimitByIP)

// Log request start
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  Logger.info(
    `Request completed`,
    {
      method: c.req.method,
      url: c.req.url,
      status: c.res.status,
      durationMs: ms,
    },
    c
  )
})

app.get('/', c => c.json({ ok: true, name: 'caiwu-backend' }))

// 健康检查和版本信息（不需要认证）
app.get('/api/health', async c => {
  const checks = {
    db: false,
    kv: false,
    r2: false,
  }

  // 1. Check DB
  try {
    const r = await Promise.race([
      c.env.DB.prepare('select 1 as ok').first<{ ok: number }>(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('db timeout')), 2000)),
    ]).catch(() => null)
    checks.db = r ? r.ok === 1 : false
  } catch (error) {
    Logger.error('Health check DB error', { error })
  }

  // 2. Check KV (Sessions)
  try {
    await Promise.race([
      c.env.SESSIONS_KV.list({ limit: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('kv timeout')), 2000)),
    ])
    checks.kv = true
  } catch (error) {
    Logger.error('Health check KV error', { error })
  }

  // 3. Check R2 (Vouchers)
  try {
    await Promise.race([
      c.env.VOUCHERS.list({ limit: 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('r2 timeout')), 2000)),
    ])
    checks.r2 = true
  } catch (error) {
    Logger.error('Health check R2 error', { error })
  }

  const healthy = checks.db && checks.kv && checks.r2

  // 获取性能指标（如果可用）
  const { getMonitoringService } = await import('./utils/monitoring.js')
  const monitoring = getMonitoringService()

  // 获取最近1小时的错误统计
  const errorStats = monitoring.getErrorStats(3600000)

  // 获取性能指标统计
  const requestDurationStats = monitoring.getMetricStats('http.request.duration', 3600000)
  const dbQueryStats = monitoring.getMetricStats('db.query.duration', 3600000)

  return c.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      metrics: {
        errors: {
          total: errorStats.total,
          bySeverity: errorStats.bySeverity,
          topCodes: Object.entries(errorStats.byCode)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([code, count]) => ({ code, count })),
        },
        performance: {
          requestDuration: requestDurationStats
            ? {
              avg: Math.round(requestDurationStats.avg),
              p95: Math.round(requestDurationStats.p95),
              p99: Math.round(requestDurationStats.p99),
            }
            : null,
          dbQueryDuration: dbQueryStats
            ? {
              avg: Math.round(dbQueryStats.avg),
              p95: Math.round(dbQueryStats.p95),
              p99: Math.round(dbQueryStats.p99),
            }
            : null,
        },
      },
    },
    healthy ? 200 : 503
  )
})

app.get('/api/version', c => c.json({ version: 'v2' }))

// 初始化数据库（如果为空）
app.post('/api/v2/init-if-empty', async c => {
  try {
    // 检查数据库是否为空（检查 employees 表是否有记录）
    const employeeCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM employees').first<{
      count: number
    }>()

    if (employeeCount && employeeCount.count > 0) {
      return jsonResponse(
        c,
        apiSuccess({
          initialized: false,
          message: '数据库已包含数据，无需初始化',
        })
      )
    }

    // 数据库为空，执行初始化
    const now = Date.now()

    // 从环境变量读取初始化密码哈希，如果不存在则使用默认值（仅用于开发环境）
    // 生产环境应通过 wrangler secret put INIT_ADMIN_PASSWORD_HASH 设置
    const passwordHash = c.env.INIT_ADMIN_PASSWORD_HASH || '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve'

    if (!c.env.INIT_ADMIN_PASSWORD_HASH) {
      Logger.warn(
        'Using default password hash for initialization. For production, set INIT_ADMIN_PASSWORD_HASH via wrangler secret.',
        {},
        c
      )
    }

    // 1. 创建总部（使用 UUID 格式）
    const hqId = 'default-hq-001' // 固定 ID 以便 INSERT OR IGNORE 幂等
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO headquarters (id, name, active) 
      VALUES (?, 'Headquarters', 1)
    `
    )
      .bind(hqId)
      .run()

    // 2. 创建职位
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO positions (
        id, code, name, level, function_role, can_manage_subordinates, 
        description, permissions, sort_order, active, created_at, updated_at
      ) VALUES (
        'pos-hq-director', 'hq_director', '总部负责人', 1, 'director', 1,
        '总部负责人', '{}', 1, 1, ?, ?
      )
    `
    )
      .bind(now, now)
      .run()

    // 3. 创建部门（使用正确的 UUID 格式）
    const deptId = 'hq-proj-init-001' // 初始化专用的总部部门 ID
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO departments (id, hq_id, name, code, active, sort_order, created_at, updated_at)
      VALUES (?, ?, '总部', 'HQ', 1, 0, ?, ?)
    `
    )
      .bind(deptId, hqId, now, now)
      .run()

    // 3.5. 为总部创建默认组织部门（使用新的逻辑，总部作为普通 department）
    const db = createDb(c.env.DB)
    const auditService = new AuditService(db)
    const deptService = new DepartmentService(db, auditService)
    await deptService.createDefaultOrgDepartments(deptId, undefined)

    // 4. 创建管理员员工（包含认证字段）
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO employees (
        id, email, name, position_id, department_id, join_date, status, active,
        password_hash, must_change_password, password_changed,
        created_at, updated_at
      ) VALUES (
        'admin_employee', 'admin@example.com', 'Admin', 'pos-hq-director', ?,
        '2023-01-01', 'regular', 1,
        ?, 0, 1,
        ?, ?
      )
    `
    )
      .bind(deptId, passwordHash, now, now)
      .run()

    return jsonResponse(
      c,
      apiSuccess({
        initialized: true,
        message: '数据库初始化成功',
        adminAccount: {
          email: 'admin@example.com',
          password: c.env.INIT_ADMIN_PASSWORD_HASH
            ? '请使用环境变量中配置的密码'
            : 'password (默认密码，请尽快修改)',
        },
      })
    )
  } catch (error: any) {
    Logger.error('Init error', { error }, c)
    throw errorHandlerV2(error, c)
  }
})

// --- Versioning Setup ---

const v2 = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Error Handlers
v2.onError(errorHandlerV2)

// Middleware for API routes
const apiMiddleware = [createIPWhitelistMiddleware(), createAuthMiddleware(), di]

v2.use('*', ...apiMiddleware)

// --- Route Registration (V2) ---
v2.route('/', authRoutesV2)
v2.route('/', masterDataRoutesV2)
v2.route('/', flowsRoutesV2)
v2.route('/', arApRoutesV2)
v2.route('/reports', reportsRoutesV2)
v2.route('/', employeesRoutesV2)
v2.route('/', salaryPaymentsRoutesV2)
v2.route('/', borrowingsRoutesV2)
v2.route('/', accountTransfersRoutesV2)
v2.route('/', fixedAssetsRoutesV2)
v2.route('/', rentalRoutesV2)
v2.route('/', siteBillsRoutesV2)
v2.route('/', approvalsRoutesV2)
v2.route('/', myRoutesV2)
v2.route('/', employeeSalariesRoutesV2)
v2.route('/', employeeAllowancesRoutesV2)
v2.route('/', allowancePaymentsRoutesV2)
v2.route('/employee-leaves', employeesLeavesRoutesV2)
v2.route('/expense-reimbursements', expenseReimbursementsRoutesV2)
v2.route('/', importRoutesV2)
v2.route('/', auditRoutesV2)
v2.route('/', ipWhitelistRoutesV2)
v2.route('/', systemConfigRoutesV2)
v2.route('/', positionPermissionsRoutesV2)

// Mount versions to app
// Default: /api/* -> v2
app.route('/api', v2)
// Explicit v2: /api/v2/* -> v2
app.route('/api/v2', v2)

// OpenAPI 文档配置
app.doc('/api/doc', {
  openapi: '3.0.0',
  info: {
    version: '2.0.0',
    title: 'Caiwu API',
  },
})

// Swagger UI
app.get('/api/ui', swaggerUI({ url: '/api/doc' }))

export default app
