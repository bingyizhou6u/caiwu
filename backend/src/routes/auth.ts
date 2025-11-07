import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import type { Env, AppVariables } from '../types.js'
import { getUserByEmail, getUserById, createSession, getSession, getUserPosition } from '../utils/db.js'
import { generateTotpSecret, verifyTotp } from '../utils/auth.js'
import { logAudit, logAuditAction } from '../utils/audit.js'
import { requireRole } from '../utils/permissions.js'
import { sendLoginNotificationEmail, generateRandomPassword, sendPasswordResetEmail } from '../utils/email.js'
import { Errors } from '../utils/errors.js'
import { validateJson, getValidatedData } from '../utils/validator.js'
import { loginSchema, changePasswordSchema, resetPasswordSchema, bindTotpSchema } from '../schemas/business.schema.js'
import type { z } from 'zod'

const authRoutes = new Hono<{ Bindings: Env, Variables: AppVariables }>()

// 已移除旧的email-only登录端点
// 所有用户必须通过员工记录创建，并通过员工记录的邮箱登录

// 登录（密码 + Google验证码）- 只允许员工记录内的账号登录
authRoutes.post('/auth/login-password', validateJson(loginSchema), async (c) => {
  const body = getValidatedData<z.infer<typeof loginSchema>>(c)
  
  const user = await getUserByEmail(c.env.DB, body.email)
  if (!user) throw Errors.UNAUTHORIZED('用户名或密码错误')
  
  // 验证员工记录是否存在（必须存在才能登录）
  const employee = await c.env.DB.prepare('select id from employees where email=? and active=1').bind(body.email).first<{ id: string }>()
  if (!employee) {
    throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
  }
  
  // 如果账号被停用，不允许登录
  if (user.active === 0) {
    throw Errors.FORBIDDEN('账号已停用')
  }
  
  if (!user.password_hash) throw Errors.FORBIDDEN('密码未设置')
  
  // 验证密码
  const ok = await bcrypt.compare(body.password, user.password_hash)
  if (!ok) throw Errors.UNAUTHORIZED('用户名或密码错误')
  
  // 检查是否需要首次修改密码
  if (user.must_change_password === 1) {
    // 首次登录，需要修改密码，不创建会话
    return c.json({ 
      mustChangePassword: true, 
      message: '首次登录，请修改密码' 
    })
  }
  
  // 密码已修改，检查是否需要二步验证
  if (user.password_changed === 1) {
    // 如果已绑定TOTP，必须提供验证码
    if (user.totp_secret) {
      if (!body.totp) {
        // 未提供验证码，返回需要二步验证
        return c.json({ 
          needTotp: true,
          message: '请输入Google验证码' 
        })
      }
      const totpValid = verifyTotp(body.totp, user.totp_secret)
      if (!totpValid) throw Errors.UNAUTHORIZED('Google验证码错误')
    } else {
      // 未绑定TOTP，返回需要绑定
      return c.json({ 
        needBindTotp: true,
        message: '请绑定Google验证码'
      })
    }
  } else {
    // 密码未修改（旧账号），也需要二步验证或修改密码
    // 如果未绑定TOTP，要求修改密码后再绑定
    if (!user.totp_secret) {
      return c.json({ 
        needBindTotp: true,
        message: '请绑定Google验证码'
      })
    } else {
      // 已绑定TOTP但密码未修改，要求输入验证码
      if (!body.totp) {
        // 未提供验证码，返回需要二步验证
        return c.json({ 
          needTotp: true,
          message: '请输入Google验证码' 
        })
      }
      const totpValid = verifyTotp(body.totp, user.totp_secret)
      if (!totpValid) throw Errors.UNAUTHORIZED('Google验证码错误')
    }
  }
  
  // 登录成功，创建会话
  const loginTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  await c.env.DB.prepare('update users set last_login_at=? where id=?').bind(Date.now(), user.id).run()
  
  // 必须基于员工记录获取职位和角色
  const { getUserPosition } = await import('../utils/db.js')
  const { getRoleByPositionCode } = await import('../utils/db.js')
  const position = await getUserPosition(c.env.DB, user.id)
  
  if (!position) {
    // 没有员工记录，不允许登录
    throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
  }
  
  // 基于职位确定角色
  const userRole = getRoleByPositionCode(position.code)
  
  const ses = await createSession(c.env.DB, user.id)
  // 根据请求协议动态设置secure属性
  const isSecure = c.req.url.startsWith('https://')
  // 获取请求的host，用于设置cookie的domain
  const host = c.req.header('host') || ''
  const cookieOptions: any = { 
    httpOnly: true, 
    sameSite: 'Lax' as const, 
    secure: isSecure, 
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7天
  }
  // 如果是生产环境（非localhost），设置domain以确保cookie正确传递
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    // 对于Cloudflare Pages，不设置domain，让浏览器自动处理
    // 如果需要跨子域名，可以设置domain为'.pages.dev'或自定义域名
  }
  setCookie(c, 'sid', ses.id, cookieOptions)
  
  // 记录审计日志（登录成功）
  await logAudit(c.env.DB, user.id, 'login', 'user', user.id, JSON.stringify({ email: user.email }))
  
  // 检查邮件提醒是否启用
  let emailNotificationEnabled = true
  try {
    const configRow = await c.env.DB.prepare('select value from system_config where key=?').bind('email_notification_enabled').first<{ value: string }>()
    emailNotificationEnabled = configRow?.value === 'true'
  } catch (err) {
    console.warn('[Login] Failed to check email notification config, defaulting to enabled:', err)
  }
  
  // 如果邮件提醒启用，发送登录提醒邮件（使用 waitUntil 确保异步任务完成）
  if (emailNotificationEnabled) {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '未知'
    
    // 使用 waitUntil 确保邮件发送任务完成
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(
        sendLoginNotificationEmail(
          c.env,
          user.email,
          user.name,
          loginTime,
          clientIP
        )
          .then((result) => {
            if (!result.success) {
              console.error(`[Login] Failed to send email notification to ${user.email}:`, result.error)
            }
          })
          .catch((err) => {
            console.error(`[Login] Error sending email notification to ${user.email}:`, err)
          })
      )
    }
  }
  
  // 返回用户信息（基于职位确定角色）
  return c.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: userRole } })
})

// 首次登录修改密码（不需要登录）
authRoutes.post('/auth/change-password-first', async (c) => {
  const { email, oldPassword, newPassword } = await c.req.json<{ email: string, oldPassword: string, newPassword: string }>()
  if (!email || !oldPassword || !newPassword) throw Errors.VALIDATION_ERROR('email、oldPassword、newPassword参数必填')
  if (newPassword.length < 6) throw Errors.VALIDATION_ERROR('密码长度至少6位')
  
  const user = await getUserByEmail(c.env.DB, email)
  if (!user) throw Errors.NOT_FOUND('用户')
  if (user.active === 0) throw Errors.FORBIDDEN('账号已停用')
  if (!user.password_hash) throw Errors.FORBIDDEN('密码未设置')
  if (user.must_change_password !== 1) throw Errors.BUSINESS_ERROR('不是首次登录')
  
  // 验证旧密码
  const ok = await bcrypt.compare(oldPassword, user.password_hash)
  if (!ok) throw Errors.UNAUTHORIZED('密码错误')
  
  // 更新密码
  const hash = await bcrypt.hash(newPassword, 10)
  await c.env.DB.prepare('update users set password_hash=?, password_changed=1, must_change_password=0 where id=?')
    .bind(hash, user.id).run()
  
  // 记录审计日志（首次修改密码）
  logAuditAction(c, 'change_password_first', 'user', user.id, JSON.stringify({ email: user.email }))
  
  // 返回成功，跳转到二步验证页面
  return c.json({ 
    ok: true, 
    message: '密码已修改，请完成二步验证'
  })
})

// 获取TOTP绑定二维码（用于二步验证页面）
authRoutes.post('/auth/get-totp-qr', async (c) => {
  const { email, password } = await c.req.json<{ email: string, password: string }>()
  if (!email || !password) throw Errors.VALIDATION_ERROR('email和password参数必填')
  
  const user = await getUserByEmail(c.env.DB, email)
  if (!user) throw Errors.NOT_FOUND('用户')
  if (user.active === 0) throw Errors.FORBIDDEN('账号已停用')
  if (!user.password_hash) throw Errors.FORBIDDEN('密码未设置')
  if (user.totp_secret) throw Errors.BUSINESS_ERROR('TOTP已绑定')
  
  // 验证密码
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw Errors.UNAUTHORIZED('密码错误')
  
  // 生成TOTP密钥和二维码
  const { secret, otpauthUrl } = generateTotpSecret(user.email)
  
  return c.json({ 
    secret,
    otpauthUrl,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
  })
})

// 首次登录绑定TOTP（不需要登录）
authRoutes.post('/auth/bind-totp-first', async (c) => {
  const { email, password, secret, totp } = await c.req.json<{ email: string, password: string, secret: string, totp: string }>()
  if (!email || !password || !secret || !totp) throw Errors.VALIDATION_ERROR('email、password、secret、totp参数必填')
  
  const user = await getUserByEmail(c.env.DB, email)
  if (!user) throw Errors.NOT_FOUND('用户')
  if (user.active === 0) throw Errors.FORBIDDEN('账号已停用')
  if (user.totp_secret) throw Errors.BUSINESS_ERROR('TOTP已绑定')
  
  // 验证密码
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw Errors.UNAUTHORIZED('密码错误')
  
  // 验证TOTP验证码
  const totpValid = verifyTotp(totp, secret)
  if (!totpValid) throw Errors.VALIDATION_ERROR('验证码错误，请重新扫描二维码')
  
  // 保存TOTP密钥
  await c.env.DB.prepare('update users set totp_secret=? where id=?').bind(secret, user.id).run()
  
  // 如果密码未修改，设置password_changed=1（标记为已修改密码）
  if (user.password_changed !== 1) {
    await c.env.DB.prepare('update users set password_changed=1 where id=?').bind(user.id).run()
  }
  
  // 记录审计日志（首次绑定TOTP）
  logAuditAction(c, 'bind_totp_first', 'user', user.id, JSON.stringify({ email: user.email }))
  
  // 登录成功，创建会话
  const loginTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  await c.env.DB.prepare('update users set last_login_at=? where id=?').bind(Date.now(), user.id).run()
  const ses = await createSession(c.env.DB, user.id)
  // 根据请求协议动态设置secure属性
  const isSecure = c.req.url.startsWith('https://')
  // 获取请求的host，用于设置cookie的domain
  const host = c.req.header('host') || ''
  const cookieOptions: any = { 
    httpOnly: true, 
    sameSite: 'Lax' as const, 
    secure: isSecure, 
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7天
  }
  // 如果是生产环境（非localhost），设置domain以确保cookie正确传递
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    // 对于Cloudflare Pages，不设置domain，让浏览器自动处理
    // 如果需要跨子域名，可以设置domain为'.pages.dev'或自定义域名
  }
  setCookie(c, 'sid', ses.id, cookieOptions)
  
  // 记录审计日志（登录成功）
  await logAudit(c.env.DB, user.id, 'login', 'user', user.id, JSON.stringify({ email: user.email }))
  
  // 检查邮件提醒是否启用
  let emailNotificationEnabled = true
  try {
    const configRow = await c.env.DB.prepare('select value from system_config where key=?').bind('email_notification_enabled').first<{ value: string }>()
    emailNotificationEnabled = configRow?.value === 'true'
  } catch (err) {
    console.warn('[Login] Failed to check email notification config, defaulting to enabled:', err)
  }
  
  // 如果邮件提醒启用，发送登录提醒邮件（使用 waitUntil 确保异步任务完成）
  if (emailNotificationEnabled) {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '未知'
    
    // 使用 waitUntil 确保邮件发送任务完成
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(
        sendLoginNotificationEmail(
          c.env,
          user.email,
          user.name,
          loginTime,
          clientIP
        )
          .then((result) => {
            if (!result.success) {
              console.error(`[Login] Failed to send email notification to ${user.email}:`, result.error)
            }
          })
          .catch((err) => {
            console.error(`[Login] Error sending email notification to ${user.email}:`, err)
          })
      )
    }
  }
  
  // 必须基于员工记录获取职位和角色
  const { getUserPosition } = await import('../utils/db.js')
  const { getRoleByPositionCode } = await import('../utils/db.js')
  const position = await getUserPosition(c.env.DB, user.id)
  
  if (!position) {
    // 没有员工记录，不允许登录
    throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
  }
  
  // 基于职位确定角色
  const userRole = getRoleByPositionCode(position.code)
  
  return c.json({ 
    ok: true, 
    message: 'Google验证码已绑定',
    user: { id: user.id, name: user.name, email: user.email, role: userRole } 
  })
})

// 生成TOTP密钥（用于设置Google Authenticator）
authRoutes.post('/auth/generate-totp', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED('未授权')
  
  const user = await getUserById(c.env.DB, userId)
  if (!user) throw Errors.NOT_FOUND('用户')
  
  const { secret, otpauthUrl } = generateTotpSecret(user.email)
  
  // 不返回secret，只返回二维码URL
  return c.json({ 
    otpauthUrl,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
  })
})

// 验证并保存TOTP密钥
authRoutes.post('/auth/enable-totp', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED('未授权')
  
  const { secret, totp } = await c.req.json<{ secret: string, totp: string }>()
  if (!secret || !totp) throw Errors.VALIDATION_ERROR('secret和totp参数必填')
  
  // 验证TOTP验证码
  const totpValid = verifyTotp(totp, secret)
  if (!totpValid) throw Errors.VALIDATION_ERROR('验证码错误，请重新扫描二维码')
  
  // 保存TOTP密钥
  await c.env.DB.prepare('update users set totp_secret=? where id=?').bind(secret, userId).run()
  
  // 记录审计日志
  logAuditAction(c, 'enable_totp', 'user', userId)
  
  return c.json({ ok: true, message: 'Google验证器已启用' })
})

// 禁用TOTP（需要密码验证）
authRoutes.post('/auth/disable-totp', async (c) => {
  const userId = c.get('userId')
  if (!userId) throw Errors.UNAUTHORIZED('未授权')
  
  const { password } = await c.req.json<{ password: string }>()
  if (!password) throw Errors.VALIDATION_ERROR('password参数必填')
  
  const user = await getUserById(c.env.DB, userId)
  if (!user) throw Errors.NOT_FOUND('用户')
  if (!user.password_hash) throw Errors.FORBIDDEN('密码未设置')
  
  // 验证密码
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw Errors.UNAUTHORIZED('密码错误')
  
  // 删除TOTP密钥
  await c.env.DB.prepare('update users set totp_secret=null where id=?').bind(userId).run()
  
  // 记录审计日志
  logAuditAction(c, 'disable_totp', 'user', userId)
  
  return c.json({ ok: true, message: 'Google验证器已禁用' })
})

authRoutes.post('/auth/logout', async (c) => {
  const { getCookie } = await import('hono/cookie')
  const { getSession } = await import('../utils/db')
  const sid = getCookie(c, 'sid')
  if (sid) {
    // 获取用户ID（在删除会话之前）
    const s = await getSession(c.env.DB, sid)
    if (s) {
      // 记录审计日志（登出）
      await logAudit(c.env.DB, s.user_id, 'logout', 'user', s.user_id)
    }
    await c.env.DB.prepare('delete from sessions where id=?').bind(sid).run()
    deleteCookie(c, 'sid')
  }
  return c.json({ ok: true })
})

// Who am I (允许未登录访问，返回 200)
authRoutes.get('/me', async (c) => {
  try {
    const cookieHeader = c.req.header('cookie')
    
    // 尝试使用 getCookie 解析
    let sid = getCookie(c, 'sid')
    
    // 如果 getCookie 失败，尝试手动解析 cookie header（备用方案）
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
    
    // 使用优化的函数一次性获取所有信息
    const { getSessionWithUserAndPosition } = await import('../utils/db.js')
    const sessionData = await getSessionWithUserAndPosition(c.env.DB, sid)
    
    if (!sessionData || !sessionData.session || !sessionData.user) {
      return c.json({ loggedIn: false })
    }
    
    if (!sessionData.position || !sessionData.role) {
      // 没有员工记录，返回未登录状态
      return c.json({ loggedIn: false, error: 'employee record not found' })
    }
    
    return c.json({ 
      loggedIn: true, 
      id: sessionData.user.id, 
      name: sessionData.user.name, 
      email: sessionData.user.email, 
      role: sessionData.role,
      position: {
        id: sessionData.position.id,
        code: sessionData.position.code,
        name: sessionData.position.name,
        level: sessionData.position.level,
        scope: sessionData.position.scope,
        canViewReports: sessionData.position.code === 'hq_admin' || sessionData.position.code === 'hq_finance' || sessionData.position.permissions?.reports === true
      }
    })
  } catch (error: any) {
    console.error('[GET /me] Error:', error)
    return c.json({ loggedIn: false })
  }
})

// 已移除用户管理相关端点
// - GET /users - 用户列表（已整合到员工管理）
// - POST /users/:id/role - 修改用户角色（角色由职位决定，不需要单独修改）
// - POST /users/:id/department - 修改用户部门（部门由员工记录决定，不需要单独修改）
// - DELETE /users/:id - 删除用户（应通过员工管理删除）
// 
// 用户账号管理现在完全通过员工管理进行：
// - 查看用户：通过 GET /api/employees 查看员工列表（包含用户账号信息）
// - 修改角色：通过修改员工的职位来自动更新角色
// - 修改部门：通过修改员工的部门来自动更新部门
// - 删除用户：通过删除员工记录来删除用户账号（需要单独处理）

// 已移除创建独立用户的端点
// 所有用户必须通过员工管理创建，创建员工时会自动创建用户账号
// 请使用 POST /api/employees 来创建员工和用户账号

// Reset password (manager)
authRoutes.post('/users/:id/reset-password', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  
  // 获取用户信息
  const user = await getUserById(c.env.DB, id)
  if (!user) throw Errors.NOT_FOUND('用户')
  
  // 生成随机密码
  const newPassword = generateRandomPassword(12)
  const hash = await bcrypt.hash(newPassword, 10)
  
  // 更新密码，设置must_change_password=1要求首次登录修改密码
  await c.env.DB.prepare('update users set password_hash=?, must_change_password=1, password_changed=0 where id=?').bind(hash, id).run()
  
  logAuditAction(c, 'reset_password', 'user', id)
  
  // 发送密码重置邮件
  const loginUrl = c.req.header('origin') || 'https://cloudflarets.com'
  let emailSent = false
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(
      sendPasswordResetEmail(c.env, user.email, user.name || user.email, newPassword, loginUrl)
        .then(result => {
          if (result.success) {
            emailSent = true
          } else {
            console.error(`[Auth] Failed to send password reset email to ${user.email}:`, result.error)
          }
        })
        .catch(error => {
          console.error(`[Auth] Error sending password reset email to ${user.email}:`, error)
        })
    )
    emailSent = true
  } else {
    try {
      const result = await sendPasswordResetEmail(c.env, user.email, user.name || user.email, newPassword, loginUrl)
      emailSent = result.success
      if (!result.success) {
        console.error(`[Auth] Failed to send password reset email to ${user.email}:`, result.error)
      }
    } catch (error) {
      console.error(`[Auth] Error sending password reset email to ${user.email}:`, error)
    }
  }
  
  return c.json({ ok: true, email_sent: emailSent })
})

// Toggle active (manager)
authRoutes.post('/users/:id/toggle-active', async (c) => {
  if (!(await requireRole(c, ['manager']))) throw Errors.FORBIDDEN()
  const id = c.req.param('id')
  const body = await c.req.json<{ active: number }>()
  
  const user = await getUserById(c.env.DB, id)
  if (!user) throw Errors.NOT_FOUND('用户')
  
  const val = body.active === 1 ? 1 : 0
  await c.env.DB.prepare('update users set active=? where id=?').bind(val, id).run()
  logAuditAction(c, val === 1 ? 'activate' : 'deactivate', 'user', id)
  return c.json({ ok: true })
})

// 已移除以下端点：
// - POST /users/:id/department - 用户部门现在由员工记录决定，不需要单独修改
// - DELETE /users/:id - 删除用户应通过员工管理进行

export { authRoutes }

