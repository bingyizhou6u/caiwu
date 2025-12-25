/**
 * 请求限流服务
 * 基于 Cloudflare KV 的滑动窗口限流实现
 */
export class RateLimitService {
  constructor(private kv: KVNamespace) { }

  /**
   * 检查是否允许请求
   * @param key 限流键 (如 'login:ip:1.2.3.4' 或 'totp:user:xxx')
   * @param limit 窗口内最大请求数
   * @param windowMs 时间窗口(毫秒)
   * @returns 是否允许请求及剩余次数
   */
  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    const now = Date.now()
    const windowKey = `ratelimit:${key}`

    // 获取当前窗口的请求记录
    const data = await this.kv.get<{ timestamps: number[] }>(windowKey, 'json')
    const timestamps = data?.timestamps || []

    // 过滤掉窗口外的旧请求
    const windowStart = now - windowMs
    const validTimestamps = timestamps.filter(ts => ts > windowStart)

    // 检查是否超过限制
    if (validTimestamps.length >= limit) {
      // 计算需要等待的时间
      const oldestInWindow = Math.min(...validTimestamps)
      const retryAfterMs = oldestInWindow + windowMs - now

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
      }
    }

    return {
      allowed: true,
      remaining: limit - validTimestamps.length - 1,
    }
  }

  /**
   * 记录一次请求
   * @param key 限流键
   * @param windowMs 时间窗口(毫秒)
   */
  async recordRequest(key: string, windowMs: number): Promise<void> {
    const now = Date.now()
    const windowKey = `ratelimit:${key}`

    // 获取当前记录
    const data = await this.kv.get<{ timestamps: number[] }>(windowKey, 'json')
    const timestamps = data?.timestamps || []

    // 过滤旧记录并添加新记录
    const windowStart = now - windowMs
    const validTimestamps = timestamps.filter(ts => ts > windowStart)
    validTimestamps.push(now)

    // 保存更新后的记录，TTL 设为窗口时间的 2 倍
    const ttlSeconds = Math.ceil((windowMs * 2) / 1000)
    await this.kv.put(windowKey, JSON.stringify({ timestamps: validTimestamps }), {
      expirationTtl: ttlSeconds,
    })
  }

  /**
   * 检查并记录请求（合并操作）
   * @param key 限流键
   * @param limit 窗口内最大请求数
   * @param windowMs 时间窗口(毫秒)
   * @returns 是否允许请求
   */
  async checkAndRecord(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
    const result = await this.checkLimit(key, limit, windowMs)

    if (result.allowed) {
      await this.recordRequest(key, windowMs)
    }

    return result
  }

  /**
   * 重置限流计数器（用于成功登录后清除失败计数）
   * @param key 限流键
   */
  async reset(key: string): Promise<void> {
    const windowKey = `ratelimit:${key}`
    await this.kv.delete(windowKey)
  }
}

// 限流配置常量
export const RATE_LIMITS = {
  // 登录：每 IP 每分钟最多 20 次
  LOGIN_BY_IP: {
    limit: 20,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'login:ip',
  },
  // 密码重置请求：每 IP 每小时最多 5 次
  PASSWORD_RESET_BY_IP: {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 小时
    keyPrefix: 'pwreset:ip',
  },
  // TOTP 验证：每用户每分钟最多 10 次
  TOTP_BY_USER: {
    limit: 10,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'totp:user',
  },
  // TOTP 重置请求：每邮箱每小时最多 5 次
  TOTP_RESET_BY_EMAIL: {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 小时
    keyPrefix: 'totpreset:email',
  },
  // 通用 API 限流：每用户每分钟最多 500 次请求
  API_BY_USER: {
    limit: 500,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'api:user',
  },
  // 通用 API 限流：每 IP 每分钟最多 1000 次请求
  API_BY_IP: {
    limit: 1000,
    windowMs: 60 * 1000, // 1 分钟
    keyPrefix: 'api:ip',
  },
} as const
