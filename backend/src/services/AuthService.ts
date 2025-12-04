import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { generateTotpSecret, verifyTotp } from '../utils/auth.js'
import { logAudit } from '../utils/audit.js'
import { UserService } from './UserService.js'
import { SystemConfigService } from './SystemConfigService.js'
import { getUserFullContext } from '../utils/db.js'
import { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { users, employees, sessions } from '../db/schema.js'

export class AuthService {
    private userService: UserService

    constructor(
        private db: DrizzleD1Database<typeof schema>,
        private kv: KVNamespace,
        private systemConfigService: SystemConfigService
    ) {
        this.userService = new UserService(db)
    }

    async login(email: string, password: string, totp?: string, context?: any, deviceInfo?: { ip?: string, userAgent?: string }) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户名或密码错误')

        // Check employee record and get name
        const employee = await this.db.select({ id: employees.id, name: employees.name })
            .from(employees)
            .where(and(eq(employees.email, email), eq(employees.active, 1)))
            .get()

        if (!employee) {
            const inactive = await this.db.select({ id: employees.id })
                .from(employees)
                .where(eq(employees.email, email))
                .get()
            if (inactive) throw Errors.FORBIDDEN('员工记录已停用，请联系管理员')
            throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
        }

        if (user.active === 0) throw Errors.FORBIDDEN('账号已停用')
        if (!user.passwordHash) throw Errors.FORBIDDEN('密码未设置')

        const ok = await bcrypt.compare(password, user.passwordHash!)
        if (!ok) throw Errors.UNAUTHORIZED('用户名或密码错误')

        // Check password change requirement
        if (user.mustChangePassword === 1) {
            return { status: 'must_change_password', message: '首次登录，请修改密码' }
        }

        // Check 2FA Config
        const twoFaConfig = await this.systemConfigService.get('2fa_enabled')
        const is2FaEnabled = twoFaConfig ? (twoFaConfig.value === true || twoFaConfig.value === 'true') : true // Default to true if not set

        // Check TOTP
        if (is2FaEnabled) {
            if (user.passwordChanged === 1) {
                if (user.totpSecret) {
                    if (!totp) return { status: 'need_totp', message: '请输入Google验证码' }
                    if (!verifyTotp(totp, user.totpSecret)) throw Errors.UNAUTHORIZED('Google验证码错误')
                } else {
                    return { status: 'need_bind_totp', message: '请绑定Google验证码' }
                }
            } else {
                if (!user.totpSecret) {
                    return { status: 'need_bind_totp', message: '请绑定Google验证码' }
                } else {
                    if (!totp) return { status: 'need_totp', message: '请输入Google验证码' }
                    if (!verifyTotp(totp, user.totpSecret)) throw Errors.UNAUTHORIZED('Google验证码错误')
                }
            }
        }

        // Login success
        await this.db.update(users)
            .set({ lastLoginAt: Date.now() })
            .where(eq(users.id, user.id))
            .run()

        const position = await this.userService.getUserPosition(user.id)
        if (!position) throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')

        const session = await this.createSession(user.id, deviceInfo)

        // Audit log
        if (context) {
            await logAudit(this.db, user.id, 'login', 'user', user.id, JSON.stringify({ email: user.email }), deviceInfo?.ip, undefined)
        }

        return {
            status: 'success',
            session,
            user: { id: user.id, name: employee.name, email: user.email }, // name 从 employees 表获取
            position
        }
    }

    async createSession(userId: string, deviceInfo?: { ip?: string, userAgent?: string }) {
        const id = uuid()
        const now = Date.now()
        const expires = now + 1000 * 60 * 60 * 24 * 7 // 7 days

        // 单点登录：删除该用户的所有旧会话 (KV + DB)
        const oldSessions = await this.db.select({ id: sessions.id })
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
        await this.db.insert(sessions).values({
            id,
            userId,
            expiresAt: expires,
            ipAddress: deviceInfo?.ip || null,
            userAgent: deviceInfo?.userAgent || null,
            createdAt: now,
            lastActiveAt: now
        }).run()

        // 2. 写入 KV (作为高性能缓存)
        // 获取完整的上下文信息
        const fullContext = await getUserFullContext(this.db, userId)
        if (fullContext) {
            const sessionData = {
                session: { id, user_id: userId, expires_at: expires },
                ...fullContext
            }
            // KV TTL 单位是秒
            await this.kv.put(`session:${id}`, JSON.stringify(sessionData), { expiration: Math.floor(expires / 1000) })
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
        const s = await this.db.select()
            .from(sessions)
            .where(eq(sessions.id, sessionId))
            .get()

        if (!s) return null
        if (s.expiresAt && s.expiresAt < Date.now()) return null

        return {
            id: s.id,
            user_id: s.userId,
            expires_at: s.expiresAt
        }
    }

    async logout(sessionId: string) {
        const session = await this.getSession(sessionId)
        if (session) {
            await logAudit(this.db, session.user_id, 'logout', 'user', session.user_id)
        }
        await this.kv.delete(`session:${sessionId}`)
        await this.db.delete(sessions).where(eq(sessions.id, sessionId)).run()
    }

    async changePasswordFirst(email: string, oldPassword: string, newPassword: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        if (!user.passwordHash) throw Errors.UNAUTHORIZED('密码未设置')
        const ok = await bcrypt.compare(oldPassword, user.passwordHash)
        if (!ok) throw Errors.UNAUTHORIZED('原密码错误')

        const hash = await bcrypt.hash(newPassword, 10)

        await this.db.update(users)
            .set({
                passwordHash: hash,
                mustChangePassword: 0,
                passwordChanged: 1
            })
            .where(eq(users.id, user.id))
            .run()

        await logAudit(this.db, user.id, 'change_password_first', 'user', user.id)

        return { status: 'success' }
    }

    async getTotpQr(email: string, password: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        if (!user.passwordHash) throw Errors.UNAUTHORIZED('密码未设置')
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) throw Errors.UNAUTHORIZED('密码错误')

        if (user.totpSecret) throw Errors.BUSINESS_ERROR('Google验证码已绑定')

        const { secret, otpauthUrl } = generateTotpSecret(email)
        return { secret, otpauthUrl }
    }

    async bindTotpFirst(email: string, password: string, secret: string, totp: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        if (!user.passwordHash) throw Errors.UNAUTHORIZED('密码未设置')
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) throw Errors.UNAUTHORIZED('密码错误')

        if (!verifyTotp(totp, secret)) throw Errors.UNAUTHORIZED('验证码错误')

        await this.db.update(users)
            .set({
                totpSecret: secret
            })
            .where(eq(users.id, user.id))
            .run()

        await logAudit(this.db, user.id, 'bind_totp', 'user', user.id)

        // Auto login after bind
        return this.login(email, password, totp)
    }
}
