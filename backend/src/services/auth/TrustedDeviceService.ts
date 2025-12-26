import { DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and, lt } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import * as schema from '../../db/schema.js'
import { trustedDevices } from '../../db/schema.js'
import { Logger } from '../../utils/logger.js'

// 设备信任有效期：90天（毫秒）
const DEVICE_TRUST_TTL = 90 * 24 * 60 * 60 * 1000

export class TrustedDeviceService {
  constructor(private db: DrizzleD1Database<typeof schema>) { }

  /**
   * 生成设备指纹 - 使用 SHA-256 哈希算法
   * 只使用浏览器和操作系统的稳定部分，移除 IP 以避免频繁变动
   */
  async generateDeviceFingerprint(employeeId: string, userAgent: string): Promise<string> {
    // 提取稳定的 UserAgent 部分
    const browser = this.parseBrowserFamily(userAgent)
    const os = this.parseOS(userAgent)
    const raw = `${employeeId}:${browser}:${os}`

    // 使用 Web Crypto API 计算 SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(raw)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // 将哈希转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    return `device_${hashHex.substring(0, 32)}`
  }

  /**
   * 解析浏览器类型
   */
  private parseBrowserFamily(userAgent: string): string {
    if (!userAgent) return 'Other'
    if (userAgent.includes('Edg/')) return 'Edge'  // Edge 必须在 Chrome 之前检测
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    return 'Other'
  }

  /**
   * 解析操作系统类型
   */
  private parseOS(userAgent: string): string {
    if (!userAgent) return 'Other'
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS'
    if (userAgent.includes('Mac OS')) return 'macOS'
    if (userAgent.includes('Windows')) return 'Windows'
    if (userAgent.includes('Android')) return 'Android'
    if (userAgent.includes('Linux')) return 'Linux'
    return 'Other'
  }

  /**
   * 检查是否是信任设备（包含过期检查）
   */
  async isTrustedDevice(userId: string, fingerprint: string): Promise<boolean> {
    const device = await this.db
      .select()
      .from(trustedDevices)
      .where(
        and(eq(trustedDevices.employeeId, userId), eq(trustedDevices.deviceFingerprint, fingerprint))
      )
      .get()

    if (!device) { return false }

    // 检查设备是否过期（90天）
    const now = Date.now()
    const createdAt = device.createdAt || 0
    if (now - createdAt > DEVICE_TRUST_TTL) {
      // 设备已过期，删除并返回 false
      await this.db.delete(trustedDevices).where(eq(trustedDevices.id, device.id)).run()
      return false
    }

    // 更新最后使用时间
    await this.db
      .update(trustedDevices)
      .set({ lastUsedAt: now })
      .where(eq(trustedDevices.id, device.id))
      .run()

    return true
  }

  /**
   * 添加信任设备
   */
  async addTrustedDevice(
    employeeId: string,
    fingerprint: string,
    deviceInfo: { ip?: string; userAgent?: string }
  ): Promise<void> {
    const now = Date.now()

    // 解析 User-Agent 生成设备名称
    const deviceName = this.parseDeviceName(deviceInfo.userAgent)

    try {
      await this.db
        .insert(trustedDevices)
        .values({
          id: uuid(),
          employeeId,
          deviceFingerprint: fingerprint,
          deviceName,
          ipAddress: deviceInfo.ip || null,
          userAgent: deviceInfo.userAgent || null,
          lastUsedAt: now,
          createdAt: now,
        })
        .run()
    } catch (error: any) {
      // 忽略唯一约束冲突（设备已存在）
      if (error.message?.includes('UNIQUE constraint failed')) {
        Logger.info('Device already trusted')
        return
      }
      throw error
    }
  }

  /**
   * 解析 User-Agent 生成可读的设备名称
   */
  private parseDeviceName(userAgent?: string): string {
    if (!userAgent) { return '未知设备' }

    // 简单解析
    if (userAgent.includes('iPhone')) { return 'iPhone' }
    if (userAgent.includes('iPad')) { return 'iPad' }
    if (userAgent.includes('Android')) { return 'Android 设备' }
    if (userAgent.includes('Mac OS')) { return 'Mac' }
    if (userAgent.includes('Windows')) { return 'Windows PC' }
    if (userAgent.includes('Linux')) { return 'Linux' }

    // 尝试提取浏览器
    if (userAgent.includes('Chrome')) { return 'Chrome 浏览器' }
    if (userAgent.includes('Firefox')) { return 'Firefox 浏览器' }
    if (userAgent.includes('Safari')) { return 'Safari 浏览器' }

    return '未知设备'
  }

  /**
   * 获取用户的所有信任设备
   */
  async getUserDevices(employeeId: string) {
    return await this.db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.employeeId, employeeId))
      .all()
  }

  /**
   * 移除信任设备
   */
  async removeTrustedDevice(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(trustedDevices)
      .where(and(eq(trustedDevices.id, id), eq(trustedDevices.employeeId, userId)))
      .run()

    return (result as any).rowsAffected > 0 || (result as any).changes > 0
  }

  /**
   * 移除用户的所有信任设备
   */
  async removeAllDevices(userId: string): Promise<void> {
    await this.db.delete(trustedDevices).where(eq(trustedDevices.employeeId, userId)).run()
  }

  /**
   * 清理所有过期设备（可定期调用）
   */
  async cleanupExpiredDevices(): Promise<number> {
    const expiredTime = Date.now() - DEVICE_TRUST_TTL
    const result = await this.db
      .delete(trustedDevices)
      .where(lt(trustedDevices.createdAt, expiredTime))
      .run()

    return (result as any).rowsAffected || (result as any).changes || 0
  }
}
