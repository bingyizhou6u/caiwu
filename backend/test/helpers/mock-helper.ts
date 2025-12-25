/**
 * Mock测试辅助函数
 * 提供常用的Mock对象和函数
 */

import { vi } from 'vitest'
import type { Context } from 'hono'

/**
 * 创建Mock的Hono Context
 */
export function createMockContext(overrides: Partial<Context> = {}): any {
  const mockEnv = {
    DB: {} as D1Database,
    SESSIONS_KV: {} as KVNamespace,
    EMAIL_SERVICE: {} as any,
  }

  const mockContext = {
    env: mockEnv,
    req: {
      json: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockReturnValue({}),
      param: vi.fn().mockReturnValue(''),
      header: vi.fn().mockReturnValue(''),
    },
    json: vi.fn().mockReturnValue({ status: 200 }),
    text: vi.fn().mockReturnValue({ status: 200 }),
    html: vi.fn().mockReturnValue({ status: 200 }),
    notFound: vi.fn().mockReturnValue({ status: 404 }),
    redirect: vi.fn().mockReturnValue({ status: 302 }),
    get: vi.fn(),
    set: vi.fn(),
    var: {},
    executionCtx: {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    },
    ...overrides,
  }

  return mockContext
}

/**
 * 创建Mock的Service对象
 */
export const createMockService = {
  /**
   * Mock AuthService
   */
  auth(): any {
    return {
      loginWithPassword: vi.fn(),
      loginWithTotp: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
      changePassword: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      setupTotp: vi.fn(),
      verifyTotp: vi.fn(),
      createSession: vi.fn(),
      validateSession: vi.fn(),
    }
  },

  /**
   * Mock EmployeeService
   */
  employee(): any {
    return {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
    }
  },

  /**
   * Mock FinanceService
   */
  finance(): any {
    return {
      createCashFlow: vi.fn(),
      getCashFlow: vi.fn(),
      listCashFlows: vi.fn(),
      reverseCashFlow: vi.fn(),
      getAccountBalance: vi.fn(),
      createTransfer: vi.fn(),
    }
  },

  /**
   * Mock AccountService
   */
  account(): any {
    return {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getBalance: vi.fn(),
      getTransactions: vi.fn(),
    }
  },

  /**
   * Mock EmailService
   */
  email(): any {
    return {
      sendEmail: vi.fn().mockResolvedValue({ success: true }),
      sendActivationEmail: vi.fn().mockResolvedValue({ success: true }),
      sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
      sendLoginNotificationEmail: vi.fn().mockResolvedValue({ success: true }),
    }
  },

  /**
   * Mock AuditService
   */
  audit(): any {
    return {
      log: vi.fn().mockResolvedValue(undefined),
      logAction: vi.fn().mockResolvedValue(undefined),
      getAuditLogs: vi.fn().mockResolvedValue([]),
    }
  },
}

/**
 * 创建Mock的中间件
 */
export const createMockMiddleware = {
  /**
   * Mock认证中间件
   */
  auth(userId: string = 'test-user-id', userPosition: any = null, userEmployee: any = null) {
    return vi.fn(async (c: any, next: any) => {
      c.set('userId', userId)
      c.set('userPosition', userPosition || {
        id: 'pos-test',
        code: 'test_admin',
        name: 'Test Admin',
        level: 1,
        permissions: {
          hr: { employee: ['view', 'create', 'update', 'delete'] },
          finance: { flow: ['view', 'create', 'update', 'delete'] },
        },
      })
      c.set('userEmployee', userEmployee || {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        departmentId: 'dept-test',
        orgDepartmentId: 'org-dept-test',
      })
      await next()
    })
  },

  /**
   * Mock权限检查中间件
   */
  permission(hasPermission: boolean = true) {
    return vi.fn(async (c: any, next: any) => {
      if (hasPermission) {
        await next()
      } else {
        return c.json({ error: 'Forbidden' }, 403)
      }
    })
  },

  /**
   * Mock依赖注入中间件
   */
  di(services: any = {}) {
    return vi.fn(async (c: any, next: any) => {
      c.set('services', {
        auth: services.auth || createMockService.auth(),
        employee: services.employee || createMockService.employee(),
        finance: services.finance || createMockService.finance(),
        account: services.account || createMockService.account(),
        email: services.email || createMockService.email(),
        audit: services.audit || createMockService.audit(),
        ...services,
      })
      await next()
    })
  },
}

/**
 * Mock D1 Database
 */
export function createMockD1Database(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
    }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  } as any
}

/**
 * Mock KV Namespace
 */
export function createMockKVNamespace(): KVNamespace {
  const store = new Map<string, string>()
  
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async () => ({ keys: Array.from(store.keys()).map(name => ({ name })) })),
  } as any
}

/**
 * Mock Cloudflare环境
 */
export function createMockEnv(overrides: any = {}): any {
  return {
    DB: createMockD1Database(),
    SESSIONS_KV: createMockKVNamespace(),
    EMAIL_SERVICE: {
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))),
    },
    ...overrides,
  }
}

/**
 * 重置所有Mock
 */
export function resetAllMocks(): void {
  vi.clearAllMocks()
}

/**
 * Mock异步函数（带延迟）
 */
export function createDelayedMock<T>(value: T, delayMs: number = 100) {
  return vi.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    return value
  })
}

/**
 * Mock带错误的函数
 */
export function createErrorMock(error: Error | string) {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  return vi.fn(async () => {
    throw errorObj
  })
}

/**
 * Mock分页数据
 */
export function createPaginatedMockData<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 10
) {
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const results = items.slice(start, end)
  
  return {
    results,
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  }
}

/**
 * 创建Mock的HTTP请求
 */
export function createMockRequest(
  method: string = 'GET',
  url: string = 'http://localhost',
  options: RequestInit = {}
): Request {
  return new Request(url, {
    method,
    ...options,
  })
}

/**
 * 创建Mock的HTTP响应
 */
export function createMockResponse(
  body: any,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}
