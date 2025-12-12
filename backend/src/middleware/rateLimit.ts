/**
 * 请求限流中间件
 * 用于保护敏感接口如登录、密码重置等
 */
import { Context, Next, MiddlewareHandler } from 'hono'
import { RATE_LIMITS } from '../services/RateLimitService.js'
import type { Env, AppVariables } from '../types.js'

// 获取客户端 IP
function getClientIP(c: Context): string {
    return c.req.header('CF-Connecting-IP')
        || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
        || c.req.header('X-Real-IP')
        || 'unknown'
}

// 通用限流中间件工厂
function createRateLimitMiddleware(
    keyPrefix: string,
    limit: number,
    windowMs: number,
    getKey: (c: Context) => string
): MiddlewareHandler<{ Bindings: Env, Variables: AppVariables }> {
    return async (c, next) => {
        const rateLimitService = c.get('services')?.rateLimit

        // 如果服务不可用，放行请求
        if (!rateLimitService) {
            console.warn('[RateLimit] Service not available, skipping')
            return next()
        }

        const key = `${keyPrefix}:${getKey(c)}`
        const result = await rateLimitService.checkAndRecord(key, limit, windowMs)

        // 设置响应头
        c.header('X-RateLimit-Limit', String(limit))
        c.header('X-RateLimit-Remaining', String(result.remaining))

        if (!result.allowed) {
            c.header('X-RateLimit-Reset', String(Math.ceil((result.retryAfterMs || 0) / 1000)))
            c.header('Retry-After', String(Math.ceil((result.retryAfterMs || 0) / 1000)))

            return c.json({
                ok: false,
                error: '请求过于频繁，请稍后再试',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfterSeconds: Math.ceil((result.retryAfterMs || 0) / 1000)
            }, 429)
        }

        return next()
    }
}

/**
 * 登录限流中间件
 * 每 IP 每分钟最多 5 次登录尝试
 */
export const loginRateLimit = createRateLimitMiddleware(
    RATE_LIMITS.LOGIN_BY_IP.keyPrefix,
    RATE_LIMITS.LOGIN_BY_IP.limit,
    RATE_LIMITS.LOGIN_BY_IP.windowMs,
    getClientIP
)

/**
 * 密码重置限流中间件
 * 每 IP 每小时最多 3 次重置请求
 */
export const passwordResetRateLimit = createRateLimitMiddleware(
    RATE_LIMITS.PASSWORD_RESET_BY_IP.keyPrefix,
    RATE_LIMITS.PASSWORD_RESET_BY_IP.limit,
    RATE_LIMITS.PASSWORD_RESET_BY_IP.windowMs,
    getClientIP
)

/**
 * TOTP 重置限流中间件
 * 每邮箱每小时最多 3 次重置请求
 */
export const totpResetRateLimit = createRateLimitMiddleware(
    RATE_LIMITS.TOTP_RESET_BY_EMAIL.keyPrefix,
    RATE_LIMITS.TOTP_RESET_BY_EMAIL.limit,
    RATE_LIMITS.TOTP_RESET_BY_EMAIL.windowMs,
    (c) => {
        // 从请求体获取邮箱
        // 注意：这需要在解析请求体之后使用
        return getClientIP(c) // 暂时使用 IP，实际邮箱在路由中检查
    }
)

/**
 * 重置特定键的限流计数（登录成功后调用）
 */
export async function resetRateLimit(c: Context<{ Bindings: Env, Variables: AppVariables }>, keyPrefix: string, keyValue: string): Promise<void> {
    const rateLimitService = c.get('services')?.rateLimit
    if (rateLimitService) {
        await rateLimitService.reset(`${keyPrefix}:${keyValue}`)
    }
}
