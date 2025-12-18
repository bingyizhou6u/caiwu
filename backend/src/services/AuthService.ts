import bcrypt from 'bcryptjs'
import QRCode from 'qrcode-svg'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { generateTotpSecret, verifyTotp } from '../utils/auth.js'
// import { logAudit } from '../utils/audit.js' // Removed
import { SystemConfigService } from './SystemConfigService.js'
import { TrustedDeviceService } from './TrustedDeviceService.js'
import { EmployeeService } from './EmployeeService.js'
import { getUserFullContext } from '../utils/db.js'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { eq, and, or } from 'drizzle-orm'
import { employees, sessions } from '../db/schema.js'
import { AuditService } from './AuditService.js'
import { EmailService } from './EmailService.js'

export class AuthService {
  private employeeService: EmployeeService
  private trustedDeviceService: TrustedDeviceService

  constructor(
    private db: DrizzleD1Database<typeof schema>,
    private kv: KVNamespace,
    private systemConfigService: SystemConfigService,
    private auditService: AuditService,
    private emailService: EmailService,
    employeeService: EmployeeService
  ) {
    this.employeeService = employeeService
    this.trustedDeviceService = new TrustedDeviceService(db)
  }

  async login(
    email: string,
    password: string,
    totp?: string,
    context?: any,
    deviceInfo?: { ip?: string; userAgent?: string }
  ) {
    const user = await this.employeeService.getUserByEmail(email)
    if (!user) {
      throw Errors.UNAUTHORIZED('用户名或密码错误')
    }

    // 检查员工记录并获取姓名（由于登录使用个人邮箱，所以需要通过个人邮箱查询）
    const employee = await this.db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.personalEmail, email), eq(employees.active, 1)))
      .get()

    if (!employee) {
      const inactive = await this.db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.personalEmail, email))
        .get()

      if (inactive) {
        throw Errors.FORBIDDEN('员工记录已停用，请联系管理员')
      }
      throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
    }

    if (user.active === 0) {
      throw Errors.FORBIDDEN('账号已停用')
    }
    if (!user.passwordHash) {
      throw Errors.FORBIDDEN('密码未设置')
    }

    const ok = await bcrypt.compare(password, user.passwordHash!)
    if (!ok) {
      throw Errors.UNAUTHORIZED('用户名或密码错误')
    }

    // 检查 2FA 配置
    const twoFaConfig = await this.systemConfigService.get('2fa_enabled')
    const is2FaEnabled = twoFaConfig
      ? twoFaConfig.value === true || twoFaConfig.value === 'true'
      : true // 如果未设置，默认为开启

    // 如果系统强制2FA，但用户已激活且没有绑定2FA，拒绝登录
    if (is2FaEnabled && user.passwordHash && !user.totpSecret) {
      throw Errors.FORBIDDEN('账号未绑定2FA，请联系管理员重置后重新绑定')
    }

    // Check TOTP - 只有新设备才需要验证
    if (is2FaEnabled && user.totpSecret) {
      // 生成设备指纹 (SHA-256)
      const deviceFingerprint = await this.trustedDeviceService.generateDeviceFingerprint(
        user.id,
        deviceInfo?.ip || 'unknown',
        deviceInfo?.userAgent || 'unknown'
      )

      // 检查是否是信任设备（包含90天过期检查）
      const isTrusted = await this.trustedDeviceService.isTrustedDevice(user.id, deviceFingerprint)

      if (!isTrusted) {
        // 新设备需要验证 TOTP
        if (!totp) {return { status: 'need_totp', message: '新设备首次登录，请输入Google验证码' }}
        if (!verifyTotp(totp, user.totpSecret)) {throw Errors.UNAUTHORIZED('Google验证码错误')}

        // TOTP 验证成功，添加到信任设备
        await this.trustedDeviceService.addTrustedDevice(user.id, deviceFingerprint, {
          ip: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
        })
      }
      // 如果是信任设备，跳过 TOTP 验证
    }

    // 登录成功
    await this.db
      .update(employees)
      .set({ lastLoginAt: Date.now() })
      .where(eq(employees.id, user.id))
      .run()

    const position = await this.employeeService.getUserPosition(user.id)
    if (!position) {
      throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
    }

    const session = await this.createSession(user.id, deviceInfo)

    // 审计日志
    if (context) {
      await this.auditService.log(
        user.id,
        'login',
        'user',
        user.id,
        JSON.stringify({ email: user.email }),
        deviceInfo?.ip,
        undefined
      )
    }

    return {
      status: 'success',
      session,
      user: { id: user.id, name: employee.name, email: user.email }, // name 从 employees 表获取
      position,
    }
  }

  async createSession(userId: string, deviceInfo?: { ip?: string; userAgent?: string }) {
    const id = uuid()
    const now = Date.now()
    const expires = now + 1000 * 60 * 60 * 24 * 7 // 7天过期

    // 单点登录：删除该用户的所有旧会话 (KV + DB)
    const oldSessions = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .all()

    if (oldSessions.length > 0) {
      for (const s of oldSessions) {
        await this.kv.delete(`session:${s.id}`)
      }
      await this.db.delete(sessions).where(eq(sessions.userId, userId)).run()
    }

    // 1. 写入 D1 (作为持久化备份和审计)
    await this.db
      .insert(sessions)
      .values({
        id,
        userId,
        expiresAt: expires,
        ipAddress: deviceInfo?.ip || null,
        userAgent: deviceInfo?.userAgent || null,
        createdAt: now,
        lastActiveAt: now,
      })
      .run()

    // 2. 写入 KV (作为高性能缓存)
    // 获取完整的上下文信息
    const fullContext = await getUserFullContext(this.db, userId)
    if (fullContext) {
      const sessionData = {
        session: { id, user_id: userId, expires_at: expires },
        ...fullContext,
      }
      // KV TTL 单位是秒
      await this.kv.put(`session:${id}`, JSON.stringify(sessionData), {
        expiration: Math.floor(expires / 1000),
      })
    }

    return { id, expires }
  }

  async getSession(sessionId: string) {
    // 优先从 KV 读取
    const cached = await this.kv.get(`session:${sessionId}`, 'json')
    if (cached) {
      return (cached as any).session
    }

    // 降级到 D1
    const s = await this.db.select().from(sessions).where(eq(sessions.id, sessionId)).get()

    if (!s) {return null}
    if (s.expiresAt && s.expiresAt < Date.now()) {return null}

    return {
      id: s.id,
      user_id: s.userId,
      expires_at: s.expiresAt,
    }
  }

  async logout(sessionId: string) {
    const session = await this.getSession(sessionId)
    if (session) {
      await this.auditService.log(session.user_id, 'logout', 'user', session.user_id)
    }
    await this.kv.delete(`session:${sessionId}`)
    await this.db.delete(sessions).where(eq(sessions.id, sessionId)).run()
  }

  async requestPasswordReset(
    email: string,
    env: { EMAIL_SERVICE?: Fetcher; EMAIL_TOKEN?: string }
  ) {
    const user = await this.employeeService.getUserByEmail(email)
    const employee = await this.db
      .select({ name: employees.name })
      .from(employees)
      .where(eq(employees.personalEmail, email))
      .get()

    if (!user || !employee) {
      // 即使未找到用户，也返回成功，防止邮箱枚举攻击
      return { status: 'success' }
    }

    const resetToken = uuid().replace(/-/g, '') + uuid().replace(/-/g, '')
    const resetExpiresAt = Date.now() + 1000 * 60 * 60 // 1小时后过期

    await this.db
      .update(employees)
      .set({
        resetToken,
        resetExpiresAt,
      })
      .where(eq(employees.id, user.id))
      .run()

    if (env.EMAIL_SERVICE) {
      await this.emailService.sendPasswordResetLinkEmail(email, employee.name || '', resetToken)
    }

    await this.auditService.log(user.id, 'request_password_reset', 'user', user.id)
    return { status: 'success' }
  }

  async verifyResetToken(token: string) {
    const user = await this.db.select().from(employees).where(eq(employees.resetToken, token)).get()

    if (!user) {
      throw Errors.NOT_FOUND('无效的重置链接')
    }

    if (user.resetExpiresAt && user.resetExpiresAt < Date.now()) {
      throw Errors.BUSINESS_ERROR('重置链接已过期，请重新请求')
    }

    return {
      email: user.email,
      valid: true,
    }
  }

  async resetPassword(
    token: string,
    password: string,
    deviceInfo?: { ip?: string; userAgent?: string }
  ) {
    const user = await this.db.select().from(employees).where(eq(employees.resetToken, token)).get()

    if (!user) {
      throw Errors.NOT_FOUND('无效的重置链接')
    }

    if (user.resetExpiresAt && user.resetExpiresAt < Date.now()) {
      throw Errors.BUSINESS_ERROR('重置链接已过期')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await this.db
      .update(employees)
      .set({
        passwordHash,
        active: 1,
        resetToken: null,
        resetExpiresAt: null,
        passwordChanged: 1,
        mustChangePassword: 0,
      })
      // @ts-ignore - Drizzle type definition issue
      .where(eq(employees.id, user.id))
      .run()

    await this.auditService.log(
      user.id,
      'reset_password',
      'user',
      user.id,
      undefined,
      deviceInfo?.ip
    )

    if (!user.personalEmail) {
      throw Errors.BUSINESS_ERROR('用户未绑定个人邮箱')
    }
    // 自动登录
    return this.login(user.personalEmail, password, undefined, undefined, deviceInfo)
  }

  // 生成用于激活的 TOTP（不需要密码，因为用户尚未自设密码）
  generateTotpForActivation(email: string) {
    const { secret, otpauthUrl } = generateTotpSecret(email)

    // 生成 QR 码作为 SVG 数据 URL（适用于不支持 Canvas 的 Edge Runtime）
    const qr = new QRCode({
      content: otpauthUrl,
      width: 200,
      height: 200,
      padding: 2,
      color: '#000000',
      background: '#ffffff',
      ecl: 'M',
    })
    const svgString = qr.svg()
    const qrCode = `data:image/svg+xml;base64,${btoa(svgString)}`

    return { secret, qrCode }
  }

  async verifyActivationToken(token: string) {
    const user = await this.db
      .select()
      .from(employees)
      .where(eq(employees.activationToken, token))
      .get()

    if (!user) {
      throw Errors.NOT_FOUND('无效的激活链接')
    }

    if (user.activationExpiresAt && user.activationExpiresAt < Date.now()) {
      throw Errors.BUSINESS_ERROR('激活链接已过期，请联系管理员重发')
    }

    if (user.active === 0 && !user.activationToken) {
      // 常规检查，虽然上面的逻辑已确认 token 存在
      throw Errors.BUSINESS_ERROR('账号已激活或停用')
    }

    return {
      email: user.email,
      valid: true,
    }
  }

  async activateAccount(
    token: string,
    password: string,
    totpSecret?: string,
    totpCode?: string,
    deviceInfo?: { ip?: string; userAgent?: string }
  ) {
    const user = await this.db
      .select()
      .from(employees)
      .where(eq(employees.activationToken, token))
      .get()

    if (!user) {
      throw Errors.NOT_FOUND('无效的激活链接')
    }

    if (user.activationExpiresAt && user.activationExpiresAt < Date.now()) {
      throw Errors.BUSINESS_ERROR('激活链接已过期')
    }

    // 如果开启了 2FA，则验证 TOTP
    const twoFaConfig = await this.systemConfigService.get('2fa_enabled')
    const is2FaEnabled = twoFaConfig
      ? twoFaConfig.value === true || twoFaConfig.value === 'true'
      : true

    if (is2FaEnabled) {
      if (!totpSecret || !totpCode) {
        throw Errors.BUSINESS_ERROR('请绑定Google验证码')
      }
      if (!verifyTotp(totpCode, totpSecret)) {
        throw Errors.UNAUTHORIZED('验证码错误')
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // 激活用户并绑定 TOTP
    await this.db
      .update(employees)
      .set({
        passwordHash,
        active: 1,
        activationToken: null, // 消耗掉 Token
        activationExpiresAt: null,
        passwordChanged: 1, // 视为已修改密码（用户已设置）
        mustChangePassword: 0,
        totpSecret: is2FaEnabled ? totpSecret : null,
      })
      // @ts-ignore - Drizzle type definition issue
      .where(eq(employees.id, user.id))
      .run()

    await this.auditService.log(
      user.id,
      'activate_account',
      'user',
      user.id,
      undefined,
      deviceInfo?.ip
    )

    if (!user.personalEmail) {
      throw Errors.BUSINESS_ERROR('用户未绑定个人邮箱')
    }
    // 自动登录 - 传递刚刚验证过的 TOTP 码
    return this.login(user.personalEmail, password, totpCode, undefined, deviceInfo)
  }
  async requestTotpReset(email: string, env: { EMAIL_SERVICE?: Fetcher; EMAIL_TOKEN?: string }) {
    const user = await this.employeeService.getUserByEmail(email)
    // 检查 `email` (公司邮箱) 和 `personalEmail` (个人邮箱)
    const employee = await this.db
      .select({ id: employees.id, name: employees.name, personalEmail: employees.personalEmail })
      .from(employees)
      .where(or(eq(employees.email, email), eq(employees.personalEmail, email)))
      .get()

    if (!user || !employee) {
      // 静默返回成功，防止枚举攻击
      return { status: 'success' }
    }

    const token = uuid().replace(/-/g, '')
    // 存入 KV: totp_reset:{token} -> userId, 有效期 30 分钟
    await this.kv.put(`totp_reset:${token}`, employee.id, { expirationTtl: 1800 })

    if (env.EMAIL_SERVICE) {
      // 优先使用个人邮箱，否则使用公司邮箱
      const targetEmail = employee.personalEmail || email
      await this.emailService.sendTotpResetEmail(targetEmail, employee.name || '', token)
    }

    await this.auditService.log(employee.id, 'request_totp_reset', 'user', employee.id)
    return { status: 'success' }
  }

  async verifyTotpResetToken(token: string) {
    const userId = await this.kv.get(`totp_reset:${token}`)
    if (!userId) {
      throw Errors.BUSINESS_ERROR('重置链接无效或已过期')
    }
    return { valid: true }
  }

  async resetTotpByToken(token: string) {
    const userId = await this.kv.get(`totp_reset:${token}`)
    if (!userId) {
      throw Errors.BUSINESS_ERROR('重置链接无效或已过期')
    }

    await this.db.update(employees).set({ totpSecret: null }).where(eq(employees.id, userId)).run()

    // 删除 Token
    await this.kv.delete(`totp_reset:${token}`)

    await this.auditService.log(userId, 'reset_totp_by_token', 'user', userId)
    return { success: true }
  }
}
