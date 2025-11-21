import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import type { Env, AppVariables } from '../types.js'
import { AuthService } from '../services/AuthService.js'
import { UserService } from '../services/UserService.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { loginSchema, changePasswordSchema, bindTotpSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'
import { Errors } from '../utils/errors.js'

const authRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// Login
authRoutes.post('/auth/login-password', validateJson(loginSchema), async (c) => {
  try {
    const body = getValidatedData<z.infer<typeof loginSchema>>(c)
    const authService = new AuthService(c.env.DB)

    const result = await authService.login(body.email, body.password, body.totp, c)

    if (result.status === 'success' && result.session) {
      // Set cookie
      const isSecure = c.req.url.startsWith('https://')
      const cookieOptions: any = {
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      }
      setCookie(c, 'sid', result.session.id, cookieOptions)

      return c.json({ ok: true, user: result.user, sid: result.session.id })
    } else {
      // Return intermediate status (need totp, must change password, etc.)
      return c.json({
        mustChangePassword: result.status === 'must_change_password',
        needTotp: result.status === 'need_totp',
        needBindTotp: result.status === 'need_bind_totp',
        message: result.message
      })
    }
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({
      ok: false,
      error: error.message,
      stack: error.stack,
      details: JSON.stringify(error)
    }, 500)
  }
})

// Change Password First
authRoutes.post('/auth/change-password-first', validateJson(changePasswordSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof changePasswordSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.changePasswordFirst(body.email, body.oldPassword, body.newPassword)
  return c.json(result)
})

// Get TOTP QR
authRoutes.post('/auth/get-totp-qr', validateJson(loginSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof loginSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.getTotpQr(body.email, body.password)
  return c.json(result)
})

// Bind TOTP First
authRoutes.post('/auth/bind-totp-first', validateJson(bindTotpSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof bindTotpSchema>>(c)
  const authService = new AuthService(c.env.DB)
  const result = await authService.bindTotpFirst(body.email, body.password, body.secret, body.totp)

  if (result.status === 'success' && result.session) {
    // Set cookie
    const isSecure = c.req.url.startsWith('https://')
    const cookieOptions: any = {
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    }
    setCookie(c, 'sid', result.session.id, cookieOptions)
    return c.json({ ok: true, user: result.user })
  } else {
    return c.json(result)
  }
})

// Logout
authRoutes.post('/auth/logout', async (c) => {
  const sid = getCookie(c, 'sid')
  if (sid) {
    const authService = new AuthService(c.env.DB)
    await authService.logout(sid)
    deleteCookie(c, 'sid')
  }
  return c.json({ ok: true })
})

// Who am I
authRoutes.get('/me', async (c) => {
  try {
    const cookieHeader = c.req.header('cookie')
    let sid = getCookie(c, 'sid')

    if (!sid && cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      for (const cookie of cookies) {
        const [name, value] = cookie.split('=')
        if (name.trim() === 'sid' && value) {
          sid = value.trim()
          break
        }
      }
    }

    if (!sid) return c.json({ loggedIn: false })

    const authService = new AuthService(c.env.DB)
    const session = await authService.getSession(sid)

    if (!session) return c.json({ loggedIn: false })

    const userService = new UserService(c.env.DB)
    const user = await userService.getUserById(session.user_id)
    if (!user) return c.json({ loggedIn: false })

    const position = await userService.getUserPosition(user.id)
    if (!position) return c.json({ loggedIn: false, error: 'employee record not found' })

    const role = userService.getRoleByPositionCode(position.code)

    return c.json({
      loggedIn: true,
      id: user.id,
      name: user.name,
      email: user.email,
      role: role,
      position: {
        id: position.id,
        code: position.code,
        name: position.name,
        level: position.level,
        scope: position.scope,
        canViewReports: position.code === 'hq_admin' || position.code === 'hq_finance' || position.permissions?.reports === true
      }
    })
  } catch (error: any) {
    console.error('[GET /me] Error:', error)
    return c.json({ loggedIn: false })
  }
})

// My Permissions
authRoutes.get('/my-permissions', async (c) => {
  const position = c.get('userPosition')
  if (!position?.permissions) {
    throw Errors.INTERNAL_ERROR('职位权限未配置，请联系管理员')
  }
  return c.json({ permissions: position.permissions })
})

export { authRoutes }
