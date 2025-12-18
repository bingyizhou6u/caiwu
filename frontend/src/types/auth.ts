import { User } from './index'

/**
 * 登录请求载荷
 * 用于登录 API 请求
 */
export interface LoginPayload {
    /** 邮箱地址（必填） */
    email: string
    /** 密码（登录时必填） */
    password: string
    /** TOTP 验证码（新设备首次登录时需要） */
    totp?: string
}

/**
 * 登录响应
 * 根据登录状态返回不同的数据
 */
export interface LoginResponse {
    /** 用户信息（登录成功时返回） */
    user?: User
    /** JWT Token（登录成功时返回） */
    token?: string
    /** Token 过期时间（秒） */
    expiresIn?: number
    /** 是否需要修改密码（首次登录或密码过期时，系统会引导用户使用重置密码功能） */
    mustChangePassword?: boolean
    /** 是否需要输入 TOTP 验证码（新设备首次登录） */
    needTotp?: boolean
    /** 错误信息（登录失败时返回） */
    error?: string
}

/**
 * 重置密码请求载荷
 * 用于密码重置 API（通过邮箱链接重置密码）
 */
export interface ResetPasswordPayload {
    /** 重置 Token（从邮箱链接获取） */
    token: string
    /** 新密码（必填，至少6位） */
    password: string
}

/**
 * 认证状态（已废弃）
 * 当前项目使用 Zustand store (useAppStore) 管理认证状态
 * @deprecated 请使用 useAppStore 替代
 */
export interface AuthState {
    user: User | null
    loggedIn: boolean
    loading: boolean
    permissions: Record<string, boolean>
}
