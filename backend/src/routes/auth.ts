import { Hono } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../types.js'
import { AuthService } from '../services/AuthService.js'
import { UserService } from '../services/UserService.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { loginSchema, changePasswordSchema, bindTotpSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'
import { Errors } from '../utils/errors.js'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL, extractBearerToken, signAuthToken, verifyAuthToken, ALT_AUTH_HEADER } from '../utils/jwt.js'
import { sendLoginNotificationEmail } from '../utils/email.js'


const authRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

const PASSWORD_LOGIN_PATHS = ['/auth/login', '/auth/login-password']

for (const path of PASSWORD_LOGIN_PATHS) {
  authRoutes.post(path, validateJson(loginSchema), handlePasswordLogin)
}

authRoutes.post('/auth/change-password-first', validateJson(changePasswordSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof changePasswordSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.changePasswordFirst(body.email, body.oldPassword, body.newPassword)
  return c.json(result)
})

authRoutes.post('/auth/get-totp-qr', validateJson(loginSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof loginSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.getTotpQr(body.email, body.password)
  return c.json(result)
})

authRoutes.post('/auth/bind-totp-first', validateJson(bindTotpSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof bindTotpSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.bindTotpFirst(body.email, body.password, body.secret, body.totp)

  if (result.status === 'success' && result.session && result.position) {
    clearLegacyCookie(c)
    const payload = await buildAuthSuccessPayload(c, result)
    return c.json({ ok: true, ...payload })
  }

  return c.json(result)
})

authRoutes.post('/auth/logout', async (c) => {
  const token = extractAuthToken(c)
  const authService = new AuthService(c.env.DB)

  if (token) {
    try {
      const payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
      await authService.logout(payload.sid)
    } catch (error) {
      console.warn('Failed to logout session:', error)
    }
  }

  clearLegacyCookie(c)
  return c.json({ ok: true })
})

authRoutes.get('/auth/me', async (c) => {
  const user = await resolveUserFromToken(c)
  return c.json({ user })
})

authRoutes.get('/me', async (c) => {
  const user = await resolveUserFromToken(c)
  return c.json({ user })
})

authRoutes.get('/my-permissions', async (c) => {
  const position = c.get('userPosition')
  if (!position?.permissions) {
    throw Errors.INTERNAL_ERROR('职位权限未配置，请联系管理员')
  }
  return c.json({ permissions: position.permissions })
})

async function handlePasswordLogin(c: any) {
  try {
    const body = getValidatedData<z.infer<typeof loginSchema>>(c)
    const authService = new AuthService(c.env.DB)

    // 获取设备信息
    const deviceInfo = {
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || undefined
    }
    const result = await authService.login(body.email, body.password, body.totp, c, deviceInfo)

    if (result.status === 'success' && result.session && result.position) {
      clearLegacyCookie(c)
      const payload = await buildAuthSuccessPayload(c, result)
      
      // 异步发送登录提醒邮件（不阻塞登录响应）
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(
          (async () => {
            try {
              // 检查邮件通知是否启用
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
      
      return c.json({ ok: true, ...payload })
    }

    return c.json({
      mustChangePassword: result.status === 'must_change_password',
      needTotp: result.status === 'need_totp',
      needBindTotp: result.status === 'need_bind_totp',
      message: result.message
    })
  } catch (error: any) {
    console.error('Login error:', error)
    const statusCode = error.statusCode || 500
    // 生产环境不返回堆栈信息，避免信息泄露
    return c.json({
      ok: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, statusCode)
  }
}

async function buildAuthSuccessPayload(c: any, result: any) {
  const token = await signAuthToken({
    sid: result.session.id,
    sub: result.user.id,
    email: result.user.email,
    name: result.user.name,
    role: result.user.role,
    position: result.position
  }, c.env.AUTH_JWT_SECRET, AUTH_TOKEN_TTL)

  return {
    token,
    expiresIn: AUTH_TOKEN_TTL,
    user: buildUserResponse(result.user, result.position, result.session.id)
  }
}

function clearLegacyCookie(c: any) {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' })
  deleteCookie(c, 'sid', { path: '/' })
}

function extractAuthToken(c: any) {
  const altHeader = c.req.header(ALT_AUTH_HEADER)
  if (altHeader) return altHeader
  return extractBearerToken(c.req.header('Authorization')) || getCookie(c, AUTH_COOKIE_NAME)
}

async function resolveUserFromToken(c: any) {
  const token = extractAuthToken(c)
  if (!token) return null

  let payload
  try {
    payload = await verifyAuthToken(token, c.env.AUTH_JWT_SECRET)
  } catch (error) {
    console.warn('Token decode failed:', error)
    return null
  }

  const authService = new AuthService(c.env.DB)
  const session = await authService.getSession(payload.sid)
  if (!session) return null

  const userService = new UserService(c.env.DB)
  const user = await userService.getUserById(payload.sub)
  if (!user || user.active === 0) return null

  const position = await userService.getUserPosition(user.id)
  if (!position) return null

  const role = userService.getRoleByPositionCode(position.code)
  return buildUserResponse({ id: user.id, name: user.name, email: user.email, role }, position, session.id)
}

function buildUserResponse(user: { id: string, name: string, email: string, role: string }, position: any, sessionId?: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionId,
    position: {
      id: position.id,
      code: position.code,
      name: position.name,
      level: position.level,
      scope: position.scope,
      permissions: position.permissions || {},
      canViewReports: position.code === 'hq_admin' || position.code === 'hq_finance' || position.permissions?.reports === true
    }
  }
}

export { authRoutes }
