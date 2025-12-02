import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { deleteCookie, getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../types.js'
import { loginSchema, changePasswordSchema, bindTotpSchema } from '../schemas/business.schema.js'
import { Errors } from '../utils/errors.js'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL, extractBearerToken, signAuthToken, verifyAuthToken, ALT_AUTH_HEADER } from '../utils/jwt.js'
import { sendLoginNotificationEmail } from '../utils/email.js'
import { Context } from 'hono'
import { employees } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const authRoutes = new OpenAPIHono<{ Bindings: Env, Variables: AppVariables }>()

// Helper to clear legacy cookies
function clearLegacyCookie(c: Context) {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' })
  deleteCookie(c, 'sid', { path: '/' })
}

// Helper to extract token
function extractAuthToken(c: Context) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) return altHeader
  return extractBearerToken(c.req.header('Authorization')) || getCookie(c, AUTH_COOKIE_NAME)
}

// Helper to build success payload
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
        function_role: result.position.function_role,
        can_manage_subordinates: result.position.can_manage_subordinates,
        permissions: result.position.permissions || {}
      }
    }
  }
}

// Login Handler
async function handleLogin(c: Context<{ Bindings: Env, Variables: AppVariables }>) {
  try {
    const body = c.req.valid('json' as any)
    const authService = c.get('services').auth

    // Get device info
    const deviceInfo = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || undefined
    }

    const result = await authService.login(body.email, body.password, body.totp, c, deviceInfo)

    if (result.status === 'success' && result.session && result.position) {
      clearLegacyCookie(c)
      const payload = await buildAuthSuccessPayload(c, result)

      // Async email notification
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
                  result.user.name,
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
      needBindTotp: result.status === 'need_bind_totp',
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

// Login Route
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

// Alias for login-password (using standard Hono route to share handler easily)
// @ts-ignore
authRoutes.post('/auth/login-password', async (c) => {
  // Manually validate body since it's not going through openapi validator
  const body = await c.req.json()
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400)
  }
  // Mock c.req.valid for handleLogin
  c.req.valid = () => body
  return handleLogin(c)
})

// Change Password First
const changePasswordFirstRoute = createRoute({
  method: 'post',
  path: '/auth/change-password-first',
  request: {
    body: {
      content: {
        'application/json': {
          schema: changePasswordSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string()
          })
        }
      },
      description: 'Change password result'
    }
  }
})

authRoutes.openapi(changePasswordFirstRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = await authService.changePasswordFirst(body.email, body.oldPassword, body.newPassword)
  return c.json(result) as any
})

// Get TOTP QR
const getTotpQrRoute = createRoute({
  method: 'post',
  path: '/auth/get-totp-qr',
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
            secret: z.string(),
            otpauthUrl: z.string()
          })
        }
      },
      description: 'TOTP QR result'
    }
  }
})

authRoutes.openapi(getTotpQrRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = await authService.getTotpQr(body.email, body.password)
  return c.json(result) as any
})

// Bind TOTP First
const bindTotpFirstRoute = createRoute({
  method: 'post',
  path: '/auth/bind-totp-first',
  request: {
    body: {
      content: {
        'application/json': {
          schema: bindTotpSchema
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
      description: 'Bind TOTP result'
    }
  }
})

authRoutes.openapi(bindTotpFirstRoute, async (c) => {
  const body = c.req.valid('json')
  const authService = c.get('services').auth
  const result = await authService.bindTotpFirst(body.email, body.password, body.secret, body.totp)

  if (result.status === 'success' && result.session && result.position) {
    clearLegacyCookie(c)
    const payload = await buildAuthSuccessPayload(c, result)
    return c.json({ ok: true, ...payload }) as any
  }

  return c.json(result) as any
})

// Logout
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

// Get Me (Public but verifies token manually)
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
    where: (employees, { eq }) => eq(employees.email, user.email),
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
        function_role: position.function_role,
        can_manage_subordinates: position.can_manage_subordinates,
        permissions: position.permissions || {}
      }
    }
  }) as any
}

authRoutes.openapi(meRoute, handleGetMe)

// Alias /me
authRoutes.get('/me', handleGetMe)

// My Permissions
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

export { authRoutes }
