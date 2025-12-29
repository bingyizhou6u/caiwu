import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../../types/index.js'
import { Errors } from '../../utils/errors.js'
import { Logger } from '../../utils/logger.js'
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL,
  extractBearerToken,
  signAuthToken,
  verifyAuthToken,
  ALT_AUTH_HEADER,
} from '../../utils/jwt.js'
import { Context } from 'hono'
import { employees, sessions } from '../../db/schema.js'
import { eq, or } from 'drizzle-orm'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'
import { cloudflareAccessAuth } from '../../middleware/cfAccess.js'
import { getUserFullContext } from '../../utils/db.js'
import { v4 as uuid } from 'uuid'

const authRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 辅助函数：提取 token
function extractAuthToken(c: Context) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) { return altHeader }
  return extractBearerToken(c.req.header('Authorization')) || getCookie(c, AUTH_COOKIE_NAME)
}

// ==================== 登出 ====================

const logoutRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any().optional(),
          }),
        },
      },
      description: 'Logout result',
    },
  },
})

authRoutes.openapi(logoutRoute, createRouteHandler(async c => {
  const token = extractAuthToken(c)
  const authService = c.var.services.auth

  if (token) {
    try {
      const payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
      await authService.logout(payload.sid)
    } catch (error) {
      Logger.warn('Failed to logout session', { error }, c)
    }
  }

  return {}
}))

// ==================== 获取当前用户信息 ====================

const meRoute = createRoute({
  method: 'get',
  path: '/auth/me',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z
              .object({
                user: z.any().nullable(),
              })
              .optional(),
          }),
        },
      },
      description: 'User info',
    },
  },
})

async function handleGetMe(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
  const token = extractAuthToken(c)
  if (!token) { return jsonResponse(c, apiSuccess({ user: null })) }

  let payload
  try {
    payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
  } catch (error) {
    Logger.warn('Token decode failed', { error }, c)
    return jsonResponse(c, apiSuccess({ user: null }))
  }

  const authService = c.var.services.auth
  const session = await authService.getSession(payload.sid)
  if (!session) { return jsonResponse(c, apiSuccess({ user: null })) }

  const employeeService = c.var.services.employee
  const user = await employeeService.getUserById(payload.sub)
  if (!user || user.active === 0) { return jsonResponse(c, apiSuccess({ user: null })) }

  const position = await employeeService.getUserPosition(user.id)
  if (!position) { return jsonResponse(c, apiSuccess({ user: null })) }

  const name = user.name || (user.personalEmail || user.email || '').split('@')[0]

  return jsonResponse(
    c,
    apiSuccess({
      user: {
        id: user.id,
        name: name,
        email: user.personalEmail || user.email || '',
        sessionId: session.id,
        position: {
          id: position.id,
          code: position.code,
          name: position.name,
          canManageSubordinates: position.canManageSubordinates,
          dataScope: position.dataScope || 'self',
          permissions: position.permissions || {},
        },
      },
    })
  )
}

authRoutes.openapi(meRoute, handleGetMe)
authRoutes.get('/me', handleGetMe)

// ==================== 获取当前用户权限 ====================

const myPermissionsRoute = createRoute({
  method: 'get',
  path: '/my-permissions',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'User permissions',
    },
  },
})

authRoutes.openapi(myPermissionsRoute, createRouteHandler(async c => {
  const position = c.get('userPosition')
  if (!position?.permissions) {
    throw Errors.INTERNAL_ERROR('职位权限未配置，请联系管理员')
  }
  return { permissions: position.permissions }
}))

// ==================== Cloudflare Access 登录 ====================

/**
 * Cloudflare Access 会话端点
 * 
 * 当用户通过 Cloudflare Access 验证后，调用此端点建立应用会话
 * 自动根据 CF JWT 中的邮箱查找员工并创建会话
 */
const cfSessionRoute = createRoute({
  method: 'post',
  path: '/auth/cf-session',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any().optional(),
            error: z.string().optional(),
          }),
        },
      },
      description: 'CF Access session result',
    },
  },
})

// 应用 CF Access 认证中间件
authRoutes.use('/auth/cf-session', cloudflareAccessAuth())

authRoutes.openapi(cfSessionRoute, async (c: Context<{ Bindings: Env; Variables: AppVariables }>) => {
  const email = c.get('cfAccessEmail')
  const cfSub = c.get('cfAccessSub')

  if (!email) {
    return c.json({
      success: false,
      error: 'No Cloudflare Access email found',
    }, 401)
  }

  try {
    const db = c.var.db

    // 根据邮箱查找员工（使用 personalEmail）
    const employee = await db
      .select()
      .from(employees)
      .where(or(
        eq(employees.email, email),
        eq(employees.personalEmail, email)
      ))
      .get()

    if (!employee) {
      // 未找到员工记录
      return c.json({
        success: false,
        error: `未找到邮箱 ${email} 对应的员工记录`,
        code: 'EMPLOYEE_NOT_FOUND'
      }, 403)
    }

    if (employee.active !== 1) {
      return c.json({
        success: false,
        error: '员工记录已停用',
        code: 'EMPLOYEE_INACTIVE'
      }, 403)
    }

    return await createCfSession(c, employee, email, cfSub || '')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error('CF session creation failed', { error: errorMessage, email }, c)
    return c.json({
      success: false,
      error: 'Session creation failed',
    }, 500)
  }
})

// 创建 CF Access 会话的辅助函数
async function createCfSession(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  employee: typeof employees.$inferSelect,
  email: string,
  cfSub: string
) {
  const db = c.var.db

  // 获取用户完整上下文（包含职位和权限）
  const userContext = await getUserFullContext(db, employee.id)
  if (!userContext || !userContext.position) {
    return c.json({
      success: false,
      error: '未找到员工职位信息',
      code: 'POSITION_NOT_FOUND'
    }, 403)
  }

  // 创建会话
  const sessionId = uuid()
  const now = Date.now()
  const expiresAt = now + AUTH_TOKEN_TTL * 1000

  await db.insert(sessions).values({
    id: sessionId,
    employeeId: employee.id,
    expiresAt,
    createdAt: now,
    userAgent: c.req.header('User-Agent') || null,
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
  })

  // 签发内部 JWT（包含 CF Access 用户 ID 用于追踪）
  const token = await signAuthToken(
    {
      sid: sessionId,
      sub: employee.id,
      email: employee.personalEmail || email,
      name: employee.name || email.split('@')[0],
      position: userContext.position,
      cfSub, // CF Access 用户 ID，用于审计追踪
    },
    c.env.AUTH_JWT_SECRET,
    AUTH_TOKEN_TTL
  )

  return jsonResponse(c, apiSuccess({
    token,
    expiresIn: AUTH_TOKEN_TTL,
    user: {
      id: employee.id,
      name: employee.name,
      email: employee.personalEmail || email,
      sessionId,
      position: {
        id: userContext.position.id,
        code: userContext.position.code,
        name: userContext.position.name,
        canManageSubordinates: userContext.position.canManageSubordinates,
        dataScope: userContext.position.dataScope || 'self',
        permissions: userContext.position.permissions || {},
      },
    },
  }))
}

export { authRoutes }
