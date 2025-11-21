import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { Errors } from '../utils/errors.js'
import { generateTotpSecret, verifyTotp } from '../utils/auth.js'
import { logAudit } from '../utils/audit.js'
import { UserService } from './UserService.js'

export class AuthService {
    private userService: UserService

    constructor(private db: D1Database) {
        this.userService = new UserService(db)
    }

    async login(email: string, password: string, totp?: string, context?: any) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户名或密码错误')

        // Check employee record
        const employee = await this.db.prepare('select id from employees where email=? and active=1').bind(email).first<{ id: string }>()
        if (!employee) {
            const inactive = await this.db.prepare('select id from employees where email=?').bind(email).first<{ id: string }>()
            if (inactive) throw Errors.FORBIDDEN('员工记录已停用，请联系管理员')
            throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')
        }

        if (user.active === 0) throw Errors.FORBIDDEN('账号已停用')
        if (!user.password_hash) throw Errors.FORBIDDEN('密码未设置')

        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) throw Errors.UNAUTHORIZED('用户名或密码错误')

        // Check password change requirement
        if (user.must_change_password === 1) {
            return { status: 'must_change_password', message: '首次登录，请修改密码' }
        }

        // Check TOTP
        if (user.password_changed === 1) {
            if (user.totp_secret) {
                if (!totp) return { status: 'need_totp', message: '请输入Google验证码' }
                if (!verifyTotp(totp, user.totp_secret)) throw Errors.UNAUTHORIZED('Google验证码错误')
            } else {
                return { status: 'need_bind_totp', message: '请绑定Google验证码' }
            }
        } else {
            if (!user.totp_secret) {
                return { status: 'need_bind_totp', message: '请绑定Google验证码' }
            } else {
                if (!totp) return { status: 'need_totp', message: '请输入Google验证码' }
                if (!verifyTotp(totp, user.totp_secret)) throw Errors.UNAUTHORIZED('Google验证码错误')
            }
        }

        // Login success
        await this.db.prepare('update users set last_login_at=? where id=?').bind(Date.now(), user.id).run()

        const position = await this.userService.getUserPosition(user.id)
        if (!position) throw Errors.FORBIDDEN('未找到员工记录，请联系管理员')

        const role = this.userService.getRoleByPositionCode(position.code)
        const session = await this.createSession(user.id)

        // Audit log
        if (context) {
            await logAudit(this.db, user.id, 'login', 'user', user.id, JSON.stringify({ email: user.email }))
        }

        return {
            status: 'success',
            session,
            user: { id: user.id, name: user.name, email: user.email, role }
        }
    }

    async createSession(userId: string) {
        const id = uuid()
        const expires = Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
        await this.db.prepare('insert into sessions(id,user_id,expires_at) values(?,?,?)').bind(id, userId, expires).run()
        return { id, expires }
    }

    async getSession(sessionId: string) {
        const s = await this.db.prepare('select * from sessions where id=?').bind(sessionId).first<any>()
        if (!s) return null
        if (s.expires_at && s.expires_at < Date.now()) return null
        return s
    }

    async logout(sessionId: string) {
        const session = await this.getSession(sessionId)
        if (session) {
            await logAudit(this.db, session.user_id, 'logout', 'user', session.user_id)
        }
        await this.db.prepare('delete from sessions where id=?').bind(sessionId).run()
    }
    async changePasswordFirst(email: string, oldPassword: string, newPassword: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        const ok = await bcrypt.compare(oldPassword, user.password_hash)
        if (!ok) throw Errors.UNAUTHORIZED('原密码错误')

        // Check if it is really first login (optional, but good for security)
        // if (user.password_changed === 1) throw Errors.FORBIDDEN('密码已修改过')

        const hash = await bcrypt.hash(newPassword, 10)
        await this.db.prepare('update users set password_hash=?, must_change_password=0, password_changed=1, updated_at=? where id=?')
            .bind(hash, Date.now(), user.id).run()

        await logAudit(this.db, user.id, 'change_password_first', 'user', user.id)

        return { status: 'success' }
    }

    async getTotpQr(email: string, password: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) throw Errors.UNAUTHORIZED('密码错误')

        if (user.totp_secret) throw Errors.BUSINESS_ERROR('Google验证码已绑定')

        const { secret, otpauthUrl } = generateTotpSecret(email)
        return { secret, otpauthUrl }
    }

    async bindTotpFirst(email: string, password: string, secret: string, totp: string) {
        const user = await this.userService.getUserByEmail(email)
        if (!user) throw Errors.UNAUTHORIZED('用户不存在')

        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) throw Errors.UNAUTHORIZED('密码错误')

        if (!verifyTotp(totp, secret)) throw Errors.UNAUTHORIZED('验证码错误')

        await this.db.prepare('update users set totp_secret=?, updated_at=? where id=?')
            .bind(secret, Date.now(), user.id).run()

        await logAudit(this.db, user.id, 'bind_totp', 'user', user.id)

        // Auto login after bind
        return this.login(email, password, totp)
    }
}
