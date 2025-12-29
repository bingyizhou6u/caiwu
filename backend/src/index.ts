// Framework imports
import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

// Type imports
import type { Env, AppVariables } from './types/index.js'

// Middleware imports
import { createAuthMiddleware } from './middleware.js'

import { di } from './middleware/di.js'
import { createRequestIdMiddleware } from './middleware/requestId.js'
import { securityHeaders } from './middleware/security.js'

import { performanceMonitor } from './middleware/performance.js'
import { createVersionMiddleware } from './middleware/version.js'

// Utility imports
import { errorHandlerV2, Errors } from './utils/errors.js'
import { Logger } from './utils/logger.js'
import { apiSuccess, jsonResponse } from './utils/response.js'
import { createDb } from './db/index.js'
import { DepartmentService } from './services/system/DepartmentService.js'
import { AuditService } from './services/system/AuditService.js'

// Route imports (V2 only)
import { authRoutes as authRoutesV2 } from './routes/v2/auth.js'
import { masterDataRoutes as masterDataRoutesV2 } from './routes/v2/master-data.js'
import { flowsRoutes as flowsRoutesV2 } from './routes/v2/flows.js'
import { arApRoutes as arApRoutesV2 } from './routes/v2/ar-ap.js'
import reportsRoutesV2 from './routes/v2/reports.js'
import { importRoutes as importRoutesV2 } from './routes/v2/import.js'
import { employeesRoutes as employeesRoutesV2 } from './routes/v2/employees.js'

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
import permissionConfigRoutesV2 from './routes/v2/permission-config.js'
import pmRoutesV2 from './routes/v2/pm/index.js'
import notificationsRoutesV2 from './routes/v2/notifications.js'

// App initialization
const app = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// Global middleware
app.use('*', createRequestIdMiddleware())
app.use('*', securityHeaders()) // 安全响应头
app.use('*', performanceMonitor()) // 性能监控
// CORS 白名单（精确匹配，防止子域名绕过）
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // 生产环境域名（需要根据实际域名配置）
  // 'https://your-domain.pages.dev',
]

app.use(
  '*',
  cors({
    origin: origin => {
      // 允许的前端域名（精确匹配，防止子域名绕过）
      if (!origin) { return null }

      // 精确匹配白名单
      if (ALLOWED_ORIGINS.includes(origin)) {
        return origin
      }

      // 开发环境：允许 localhost 和 127.0.0.1（任何端口）
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return origin
      }

      // 生产环境：仅允许特定的 pages.dev 域名（需要配置）
      // 注意：使用 startsWith 而不是 includes，防止 evil.pages.dev 绕过
      // const productionDomain = 'https://your-domain.pages.dev'
      // if (origin === productionDomain) {
      //   return origin
      // }

      return null
    },
    credentials: true,
  })
)
// 通用 API 速率限制（基于 IP）


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

  // 获取缓存统计（如果可用）
  let cacheStats = null
  try {
    // 注意：在健康检查端点中，services 可能还未初始化
    // 这里尝试获取，如果失败则忽略
    const services = c.get('services')
    // KVCachedMasterDataService 有 getCacheStats 方法，但类型是 MasterDataService
    // 使用类型断言或检查方法是否存在
    if (services?.masterData && 'getCacheStats' in services.masterData) {
      cacheStats = (services.masterData as any).getCacheStats()
    }
  } catch (error) {
    // 忽略错误，缓存统计不是必需的
  }

  // 获取最近1小时的错误统计
  const errorStats = monitoring.getErrorStats(3600000)

  // 获取性能指标统计
  const requestDurationStats = monitoring.getMetricStats('http.request.duration', 3600000)
  const dbQueryStats = monitoring.getMetricStats('db.query.duration', 3600000)
  const slowQueryStats = monitoring.getMetricStats('db.query.slow', 3600000)
  const batchQueryStats = monitoring.getMetricStats('db.query.batch.duration', 3600000)

  // 生产环境隐藏敏感信息
  const isProduction = c.req.url.includes('https://') && !c.req.url.includes('localhost')

  // 构建响应对象
  const responseData: any = {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }

  // 生产环境不返回详细指标
  if (!isProduction) {
    responseData.metrics = {
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
        slowQueries: slowQueryStats
          ? {
            count: slowQueryStats.count,
            avg: Math.round(slowQueryStats.avg),
            max: Math.round(slowQueryStats.max),
          }
          : null,
        batchQueryDuration: batchQueryStats
          ? {
            avg: Math.round(batchQueryStats.avg),
            p95: Math.round(batchQueryStats.p95),
            p99: Math.round(batchQueryStats.p99),
          }
          : null,
      },
    }
    // 慢查询详情（最近10条）
    // MonitoringService 没有公开 getRecentMetrics 方法，需要直接访问内部 metrics
    // 使用类型断言访问私有属性（仅用于健康检查端点）
    const monitoringAny = monitoring as any
    const allMetrics = monitoringAny.metrics || []
    const slowQueryMetrics = allMetrics
      .filter((m: any) => m.name === 'db.query.slow')
      .sort((a: any, b: any) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map((m: any) => ({
        query: m.tags?.query || 'unknown',
        duration: m.value,
        timestamp: m.timestamp,
        severity: m.tags?.severity || 'warning',
      }))
    responseData.slowQueries = slowQueryMetrics
    // 缓存统计
    responseData.cache = cacheStats || null
  }

  return c.json(responseData, healthy ? 200 : 503)
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

    // 从环境变量读取初始化管理员邮箱（可选，默认为 admin@example.com）
    const adminEmail = c.env.INIT_ADMIN_EMAIL || 'admin@example.com'

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
        id, code, name, data_scope, can_manage_subordinates, 
        description, permissions, sort_order, active, created_at, updated_at
      ) VALUES (
        'pos-hq-director', 'hq_director', '总部负责人', 'all', 1,
        '总部负责人', '{}', 1, 1, ?, ?
      )
    `
    )
      .bind(now, now)
      .run()

    // 3. 创建项目（原部门表已合并至项目表）
    const deptId = 'hq-proj-init-001' // 初始化专用的总部项目 ID
    await c.env.DB.prepare(
      `
      INSERT OR IGNORE INTO projects (id, hq_id, name, code, active, sort_order, created_at, updated_at)
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
        id, email, personal_email, name, position_id, project_id, join_date, status, active,
        created_at, updated_at
      ) VALUES (
        'admin_employee', ?, ?, 'Admin', 'pos-hq-director', ?,
        '2023-01-01', 'regular', 1,
        ?, ?
      )
    `
    )
      .bind(adminEmail, adminEmail, deptId, now, now)
      .run()

    return jsonResponse(
      c,
      apiSuccess({
        initialized: true,
        message: '数据库初始化成功',
        adminAccount: {
          email: adminEmail,
          note: '该账号已配置为超级管理员，请确保 Cloudflare Access 允许该邮箱登录',
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
const apiMiddleware = [
  createVersionMiddleware(), // 版本检测（最先执行）
  di,                        // 依赖注入（必须在依赖服务的中间件之前）


  createAuthMiddleware(),
]

v2.use('*', ...apiMiddleware)

// --- Route Registration (V2) ---
v2.route('/', authRoutesV2)
v2.route('/', masterDataRoutesV2)
v2.route('/', flowsRoutesV2)
v2.route('/', arApRoutesV2)
v2.route('/reports', reportsRoutesV2)
v2.route('/', employeesRoutesV2)
v2.route('/', salaryPaymentsRoutesV2)
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

v2.route('/', systemConfigRoutesV2)
v2.route('/', positionPermissionsRoutesV2)
v2.route('/permission-config', permissionConfigRoutesV2)
v2.route('/pm', pmRoutesV2)
v2.route('/notifications', notificationsRoutesV2)

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
    description: 'AR公司财务管理系统 API - 所有时间基于迪拜时间 (UTC+4)',
  },
})

// Swagger UI
app.get('/api/ui', swaggerUI({ url: '/api/doc' }))

export default app
