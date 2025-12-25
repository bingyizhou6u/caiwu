import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { deleteCookie, getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../../types.js'
import { loginSchema } from '../../schemas/business.schema.js'
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
import { employees } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import {
  loginRateLimit,
  passwordResetRateLimit,
  totpResetRateLimit,
  resetRateLimit,
} from '../../middleware/rateLimit.js'
import { RATE_LIMITS } from '../../services/common/RateLimitService.js'
import { apiSuccess, jsonResponse } from '../../utils/response.js'
import { createRouteHandler } from '../../utils/route-helpers.js'

const authRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>()

// 辅助函数：提取 token
function extractAuthToken(c: Context) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) { return altHeader }
  return extractBearerToken(c.req.header('Authorization')) || getCookie(c, AUTH_COOKIE_NAME)
}

// 辅助函数：构建成功响应载荷
async function buildAuthSuccessPayload(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  result: any
) {
  const token = await signAuthToken(
    {
      sid: result.session.id,
      sub: result.user.id,
      email: result.user.email,
      name: result.user.name,
      position: result.position,
    },
    c.env.AUTH_JWT_SECRET,
    AUTH_TOKEN_TTL
  )

  return {
    token,
    expiresIn: AUTH_TOKEN_TTL,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      sessionId: result.session.id,
      position: {
        id: result.position.id,
        code: result.position.code,
        name: result.position.name,
        canManageSubordinates: result.position.canManageSubordinates,
        dataScope: result.position.dataScope || 'self',
        permissions: result.position.permissions || {},
      },
    },
  }
}

// 登录处理器
async function handleLogin(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
  try {
    Logger.info('Login attempt started', { path: c.req.path }, c)

    const body = (await c.req.json()) as { email: string; password: string; totp?: string }
    Logger.info('Login body parsed', { email: body.email }, c)

    const authService = c.var.services.auth
    if (!authService) {
      Logger.error('AuthService not found in context', {}, c)
      throw new Error('AuthService not initialized')
    }
    Logger.info('AuthService obtained', {}, c)

    // 获取设备信息
    const deviceInfo = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || undefined,
    }

    Logger.info('Calling authService.login', { email: body.email }, c)
    const result = await authService.login(body.email, body.password, body.totp, c, deviceInfo)
    Logger.info('Login result', { status: result.status }, c)

    if (result.status === 'success' && result.session && result.position) {
      const payload = await buildAuthSuccessPayload(c, result)

      // 异步邮件通知
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const configRow = (await c.env.DB.prepare(
                'SELECT value FROM system_config WHERE key = ?'
              )
                .bind('email_notification_enabled')
                .first()) as { value: string } | null

              if (configRow?.value === 'true') {
                const loginTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                const emailService = c.var.services.email
                await emailService.sendLoginNotificationEmail(
                  result.user.email,
                  result.user.name || '',
                  loginTime,
                  deviceInfo.ip
                )
              }
            } catch (emailError) {
              Logger.error('Failed to send login notification email', { error: emailError }, c)
            }
          })()
        )
      }

      return jsonResponse(c, apiSuccess(payload))
    }

    // 非成功状态，但在业务上是预期的（如需要改密码）
    // Returns as Success but with flags in data
    return jsonResponse(
      c,
      apiSuccess({
        mustChangePassword: result.status === 'must_change_password',
        needTotp: result.status === 'need_totp',
        message: result.message,
      })
    )
  } catch (error: any) {
    // Let errorHandlerV2 handle standard errors
    throw error
  }
}

// 登录路由
const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any().optional(),
            error: z.any().optional(),
          }),
        },
      },
      description: 'Login result',
    },
  },
})

// 应用限流中间件到登录路由
authRoutes.use('/auth/login', loginRateLimit)
authRoutes.openapi(loginRoute, handleLogin)

// 登出
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

// 获取“我”的信息
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

// 我的权限
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

// 验证激活令牌
const verifyActivationTokenRoute = createRoute({
  method: 'get',
  path: '/auth/activate/verify',
  request: {
    query: z.object({
      token: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              email: z.string(),
              valid: z.boolean(),
            }),
          }),
        },
      },
      description: 'Token validation result',
    },
  },
})

authRoutes.openapi(verifyActivationTokenRoute, createRouteHandler(async (c: any) => {
  const { token } = c.req.valid('query')
  const authService = c.var.services.auth
  return await authService.verifyActivationToken(token)
}) as any)

// 生成用于激活的 TOTP（不需要密码）
const generateTotpForActivationRoute = createRoute({
  method: 'post',
  path: '/auth/generate-totp-for-activation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              secret: z.string(),
              qrCode: z.string(),
            }),
          }),
        },
      },
      description: 'TOTP secret and QR code',
    },
  },
})

authRoutes.openapi(generateTotpForActivationRoute, createRouteHandler(async (c: any) => {
  const body = c.req.valid('json') as { email: string }
  const authService = c.var.services.auth
  return authService.generateTotpForActivation(body.email)
}) as any)

// 激活账号
const activateAccountRoute = createRoute({
  method: 'post',
  path: '/auth/activate',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string(),
            password: z.string().min(6),
            totpSecret: z.string().optional(),
            totpCode: z.string().length(6).optional(),
          }),
        },
      },
    },
  },
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
      description: 'Activation result',
    },
  },
})

authRoutes.openapi(activateAccountRoute, async c => {
  const body = c.req.valid('json')
  const authService = c.var.services.auth

  const deviceInfo = {
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    userAgent: c.req.header('User-Agent') || undefined,
  }

  const result = await authService.activateAccount(
    body.token,
    body.password,
    body.totpSecret,
    body.totpCode,
    deviceInfo
  )

  if (result.status === 'success' && result.session && result.position) {
    const payload = await buildAuthSuccessPayload(c, result)
    return jsonResponse(c, apiSuccess(payload))
  }
  return jsonResponse(c, apiSuccess(result))
})

// 验证重置令牌
const verifyResetTokenRoute = createRoute({
  method: 'get',
  path: '/auth/reset-password/verify',
  request: {
    query: z.object({
      token: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              email: z.string(),
              valid: z.boolean(),
            }),
          }),
        },
      },
      description: 'Token validation result',
    },
  },
})

authRoutes.openapi(verifyResetTokenRoute, createRouteHandler(async (c: any) => {
  const { token } = c.req.valid('query')
  const authService = c.var.services.auth
  return await authService.verifyResetToken(token)
}) as any)

// 重置密码
const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/auth/reset-password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string(),
            password: z.string().min(6),
          }),
        },
      },
    },
  },
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
      description: 'Reset result',
    },
  },
})

// 应用限流中间件到密码重置路由
authRoutes.use('/auth/reset-password', passwordResetRateLimit)
authRoutes.openapi(resetPasswordRoute, async c => {
  const body = c.req.valid('json')
  const authService = c.var.services.auth

  const deviceInfo = {
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    userAgent: c.req.header('User-Agent') || undefined,
  }

  const result = await authService.resetPassword(body.token, body.password, deviceInfo)

  if (result.status === 'success' && result.session && result.position) {
    const payload = await buildAuthSuccessPayload(c, result)
    return jsonResponse(c, apiSuccess(payload))
  }
  return jsonResponse(c, apiSuccess(result))
})

// 请求"自己"的重置链接（已认证）
const requestMyResetLinkRoute = createRoute({
  method: 'post',
  path: '/auth/request-my-reset-link',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              status: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
      description: 'Reset link request result',
    },
  },
})

authRoutes.openapi(requestMyResetLinkRoute, createRouteHandler(async c => {
  const userId = c.get('userId')
  if (!userId) {
    throw Errors.UNAUTHORIZED('请先登录')
  }

  const employeeService = c.var.services.employee
  const user = await employeeService.getUserById(userId)
  if (!user?.personalEmail && !user?.email) {
    throw Errors.UNAUTHORIZED('用户信息不完整')
  }

  const authService = c.var.services.auth
  await authService.requestPasswordReset(user.personalEmail || user.email || '', c.env)

  return {
    status: 'ok',
    message: '密码重置链接已发送至您的邮箱，请查收',
  }
}))

// 请求 TOTP 重置（未认证）
const requestTotpResetRoute = createRoute({
  method: 'post',
  path: '/auth/mobile/request-totp-reset',
  summary: 'Request TOTP Reset Link',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              status: z.string(),
              message: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Reset link requested',
    },
  },
})

// 应用限流中间件到 TOTP 重置路由
authRoutes.use('/auth/mobile/request-totp-reset', totpResetRateLimit)
authRoutes.openapi(requestTotpResetRoute, createRouteHandler(async (c: any) => {
  const body = c.req.valid('json') as { email: string }
  const authService = c.var.services.auth
  return await authService.requestTotpReset(body.email, c.env)
}) as any)

// 验证 TOTP 重置令牌
const verifyTotpResetTokenRoute = createRoute({
  method: 'get',
  path: '/auth/mobile/reset-totp/verify',
  summary: 'Verify TOTP Reset Token',
  request: {
    query: z.object({
      token: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              valid: z.boolean(),
            }),
          }),
        },
      },
      description: 'Token validation result',
    },
  },
})

authRoutes.openapi(verifyTotpResetTokenRoute, createRouteHandler(async (c: any) => {
  const { token } = c.req.valid('query')
  const authService = c.var.services.auth
  return await authService.verifyTotpResetToken(token)
}) as any)

// 确认 TOTP 重置
const confirmTotpResetRoute = createRoute({
  method: 'post',
  path: '/auth/mobile/reset-totp/confirm',
  summary: 'Confirm TOTP Reset',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              success: z.boolean(),
            }),
          }),
        },
      },
      description: 'TOTP reset result',
    },
  },
})

authRoutes.openapi(confirmTotpResetRoute, createRouteHandler(async (c: any) => {
  const body = c.req.valid('json') as { token: string }
  const authService = c.var.services.auth
  return await authService.resetTotpByToken(body.token)
}) as any)

export { authRoutes }
