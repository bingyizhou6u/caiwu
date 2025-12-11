import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { deleteCookie, getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../types.js'
import { loginSchema } from '../schemas/business.schema.js'
import { Errors } from '../utils/errors.js'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL, extractBearerToken, signAuthToken, verifyAuthToken, ALT_AUTH_HEADER } from '../utils/jwt.js'
import { sendLoginNotificationEmail } from '../utils/email.js'
import { Context } from 'hono'
import { employees } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const authRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// 辅助函数：清除旧版 cookie
function clearLegacyCookie(c: Context) {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' })
  deleteCookie(c, 'sid', { path: '/' })
}

// 辅助函数：提取 token
function extractAuthToken(c: Context) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) return altHeader
  return extractBearerToken(c.req.header('Authorization')) || getCookie(c, AUTH_COOKIE_NAME)
}

// 辅助函数：构建成功响应载荷
async function buildAuthSuccessPayload(c: Context<{ Bindings: Env, Variables: AppVariables }>, result: any) {
  const token = await signAuthToken({
    sid: result.session.id,
    sub: result.user.id,
    email: result.user.email,
    name: result.user.name,
    position: result.position
  }, c.env.AUTH_JWT_SECRET, AUTH_TOKEN_TTL)

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
        level: result.position.level,
        functionRole: result.position.functionRole,
        canManageSubordinates: result.position.canManageSubordinates,
        permissions: result.position.permissions || {}
      }
    }
  }
}

// 登录处理器
async function handleLogin(c: Context<{ Bindings: Env, Variables: AppVariables }>) {
  try {
    const body = await c.req.json() as { email: string; password: string; totp?: string }
    const authService = c.get('services').auth

    // 获取设备信息
    const deviceInfo = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || undefined
    }

    const result = await authService.login(body.email, body.password, body.totp, c, deviceInfo)

    if (result.status === 'success' && result.session && result.position) {
      clearLegacyCookie(c)
      const payload = await buildAuthSuccessPayload(c, result)

      // 异步邮件通知
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const configRow = await c.env.DB.prepare(
                'SELECT value FROM system_config WHERE key = ?'
              ).bind('email_notification_enabled').first() as { value: string } | null

              if (configRow?.value === 'true') {
                const loginTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                await sendLoginNotificationEmail(
                  c.env,
                  result.user.email,
                  result.user.name || '',
                  loginTime,
                  deviceInfo.ip
                )
              }
            } catch (emailError) {
              console.error('Failed to send login notification email:', emailError)
            }
          })()
        )
      }

      return c.json({ ok: true, ...payload }) as any
    }

    return c.json({
      ok: false,
      mustChangePassword: result.status === 'must_change_password',
      needTotp: result.status === 'need_totp',
      message: result.message
    }) as any
  } catch (error: any) {
    console.error('Login error:', error)
    const statusCode = error.statusCode || 500
    return c.json({
      ok: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, statusCode as any) as any
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
          schema: loginSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            token: z.string().optional(),
            expiresIn: z.number().optional(),
            user: z.any().optional(),
            mustChangePassword: z.boolean().optional(),
            needTotp: z.boolean().optional(),
            needBindTotp: z.boolean().optional(),
            message: z.string().optional(),
            error: z.string().optional(),
            code: z.string().optional()
          })
        }
      },
      description: 'Login result'
    }
  }
})

authRoutes.openapi(loginRoute, handleLogin)

// 账号密码登录的别名（使用标准 Hono 路由以便共享处理器）
// @ts-ignore
authRoutes.post('/auth/login-password', async (c) => {
  // 手动验证请求体，因为它不经过 openapi 验证器
  const body = await c.req.json()
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400)
  }
  // 模拟 c.req.valid 供 handleLogin 使用
  c.req.valid = () => body
  return handleLogin(c)
})



// 登出
const logoutRoute = createRoute({
  method: 'post',
  path: '/auth/logout',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean()
          })
        }
      },
      description: 'Logout result'
    }
  }
})

authRoutes.openapi(logoutRoute, async (c) => {
  const token = extractAuthToken(c)
  const authService = c.get('services').auth

  if (token) {
    try {
      const payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
      await authService.logout(payload.sid)
    } catch (error) {
      console.warn('Failed to logout session:', error)
    }
  }

  clearLegacyCookie(c)
  return c.json({ ok: true }) as any
})

// 获取“我”的信息（公开路由，但手动验证 token）
const meRoute = createRoute({
  method: 'get',
  path: '/auth/me',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            user: z.any().nullable()
          })
        }
      },
      description: 'User info'
    }
  }
})

async function handleGetMe(c: Context<{ Bindings: Env, Variables: AppVariables }>) {
  const token = extractAuthToken(c)
  if (!token) return c.json({ user: null }) as any

  let payload
  try {
    payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
  } catch (error) {
    console.warn('Token decode failed:', error)
    return c.json({ user: null }) as any
  }

  const authService = c.get('services').auth
  const session = await authService.getSession(payload.sid)
  if (!session) return c.json({ user: null }) as any

  const userService = c.get('services').user
  const user = await userService.getUserById(payload.sub)
  if (!user || user.active === 0) return c.json({ user: null }) as any

  const position = await userService.getUserPosition(user.id)
  if (!position) return c.json({ user: null }) as any

  const db = c.get('db')
  const employee = await db.query.employees.findFirst({
    where: (employees, { eq }) => eq(employees.personalEmail, user.email), // Use personalEmail since users.email is the personal email
    columns: { name: true }
  })

  const name = employee?.name || user.email.split('@')[0]

  return c.json({
    user: {
      id: user.id,
      name: name,
      email: user.email,
      sessionId: session.id,
      position: {
        id: position.id,
        code: position.code,
        name: position.name,
        level: position.level,
        functionRole: position.functionRole,
        canManageSubordinates: position.canManageSubordinates,
        permissions: position.permissions || {}
      }
    }
  }) as any
}

authRoutes.openapi(meRoute, handleGetMe)

// /me 的别名
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
            permissions: z.any()
          })
        }
      },
      description: 'User permissions'
    }
  }
})

authRoutes.openapi(myPermissionsRoute, async (c) => {
  const position = c.get('userPosition')
  if (!position?.permissions) {
    throw Errors.INTERNAL_ERROR('职位权限未配置，请联系管理员')
  }
  return c.json({ permissions: position.permissions }) as any
})

// 验证激活令牌
const verifyActivationTokenRoute = createRoute({
  method: 'get',
  path: '/auth/activate/verify',
  request: {
    query: z.object({
      token: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string(),
            valid: z.boolean()
          })
        }
      },
      description: 'Token validation result'
    }
  }
})

authRoutes.openapi(verifyActivationTokenRoute, async (c) => {
  const { token } = c.req.valid('query')
  const authService = c.get('services').auth
  const result = await authService.verifyActivationToken(token)
  return c.json(result) as any
})

// 生成用于激活的 TOTP（不需要密码）
const generateTotpForActivationRoute = createRoute({
  method: 'post',
  path: '/auth/generate-totp-for-activation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            secret: z.string(),
            qrCode: z.string()
          })
        }
      },
      description: 'TOTP secret and QR code'
    }
  }
})

authRoutes.openapi(generateTotpForActivationRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = authService.generateTotpForActivation(body.email)
  return c.json(result) as any
})

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
            totpCode: z.string().length(6).optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Activation result'
    }
  }
})

authRoutes.openapi(activateAccountRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth

  const deviceInfo = {
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    userAgent: c.req.header('User-Agent') || undefined
  }

  const result = await authService.activateAccount(body.token, body.password, body.totpSecret, body.totpCode, deviceInfo)

  if (result.status === 'success' && result.session && result.position) {
    clearLegacyCookie(c)
    const payload = await buildAuthSuccessPayload(c, result)
    return c.json({ ok: true, ...payload }) as any
  }
  return c.json(result) as any
})


// 验证重置令牌
const verifyResetTokenRoute = createRoute({
  method: 'get',
  path: '/auth/reset-password/verify',
  request: {
    query: z.object({
      token: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string(),
            valid: z.boolean()
          })
        }
      },
      description: 'Token validation result'
    }
  }
})

authRoutes.openapi(verifyResetTokenRoute, async (c) => {
  const { token } = c.req.valid('query')
  const authService = c.get('services').auth
  const result = await authService.verifyResetToken(token)
  return c.json(result) as any
})

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
            password: z.string().min(6)
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.any()
        }
      },
      description: 'Reset result'
    }
  }
})

authRoutes.openapi(resetPasswordRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth

  const deviceInfo = {
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    userAgent: c.req.header('User-Agent') || undefined
  }

  const result = await authService.resetPassword(body.token, body.password, deviceInfo)

  if (result.status === 'success' && result.session && result.position) {
    clearLegacyCookie(c)
    const payload = await buildAuthSuccessPayload(c, result)
    return c.json({ ok: true, ...payload }) as any
  }
  return c.json(result) as any
})

// 请求“自己”的重置链接（已认证）
const requestMyResetLinkRoute = createRoute({
  method: 'post',
  path: '/auth/request-my-reset-link',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            message: z.string()
          })
        }
      },
      description: 'Reset link request result'
    }
  }
})

authRoutes.openapi(requestMyResetLinkRoute, async (c) => {
  // 从上下文获取当前用户（由 auth 中间件设置）
  const userId = c.get('userId')
  if (!userId) {
    throw Errors.UNAUTHORIZED('请先登录')
  }

  const userService = c.get('services').user
  const user = await userService.getUserById(userId)
  if (!user?.email) {
    throw Errors.UNAUTHORIZED('用户信息不完整')
  }

  const authService = c.get('services').auth
  await authService.requestPasswordReset(user.email, c.env)

  return c.json({
    status: 'ok',
    message: '密码重置链接已发送至您的邮箱，请查收'
  }) as any
})

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
            email: z.string().email()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            message: z.string().optional()
          })
        }
      },
      description: 'Reset link requested'
    }
  }
})

authRoutes.openapi(requestTotpResetRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = await authService.requestTotpReset(body.email, c.env)
  return c.json(result) as any
})

// 验证 TOTP 重置令牌
const verifyTotpResetTokenRoute = createRoute({
  method: 'get',
  path: '/auth/mobile/reset-totp/verify',
  summary: 'Verify TOTP Reset Token',
  request: {
    query: z.object({
      token: z.string()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            valid: z.boolean()
          })
        }
      },
      description: 'Token validation result'
    }
  }
})

authRoutes.openapi(verifyTotpResetTokenRoute, async (c) => {
  const { token } = c.req.valid('query')
  const authService = c.get('services').auth
  const result = await authService.verifyTotpResetToken(token)
  return c.json(result) as any
})

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
            token: z.string()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean()
          })
        }
      },
      description: 'TOTP reset result'
    }
  }
})

authRoutes.openapi(confirmTotpResetRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = await authService.resetTotpByToken(body.token)
  return c.json(result) as any
})

export { authRoutes }
