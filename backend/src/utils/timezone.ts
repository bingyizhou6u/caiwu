/**
 * 业务时区工具函数
 * 
 * 系统统一使用迪拜时间 (UTC+4) 作为业务时区
 * 所有业务日期、报表统计都基于此时区
 */

// 业务时区配置
export const BUSINESS_TIMEZONE = 'Asia/Dubai'
export const BUSINESS_TIMEZONE_OFFSET = 4 // UTC+4
export const BUSINESS_TIMEZONE_OFFSET_MS = BUSINESS_TIMEZONE_OFFSET * 60 * 60 * 1000

/**
 * 获取当前业务时区的日期字符串 (YYYY-MM-DD)
 */
export function getBusinessDate(utcTimestamp?: number): string {
    const ts = utcTimestamp ?? Date.now()
    const businessTime = new Date(ts + BUSINESS_TIMEZONE_OFFSET_MS)
    return businessTime.toISOString().slice(0, 10)
}

/**
 * 获取当前业务时区的日期时间字符串 (YYYY-MM-DD HH:mm:ss)
 */
export function getBusinessDateTime(utcTimestamp?: number): string {
    const ts = utcTimestamp ?? Date.now()
    const businessTime = new Date(ts + BUSINESS_TIMEZONE_OFFSET_MS)
    return businessTime.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 获取业务日期的月初日期 (YYYY-MM-01)
 */
export function getBusinessMonthStart(utcTimestamp?: number): string {
    const dateStr = getBusinessDate(utcTimestamp)
    return dateStr.slice(0, 8) + '01'
}

/**
 * 获取业务日期的月末日期
 */
export function getBusinessMonthEnd(utcTimestamp?: number): string {
    const dateStr = getBusinessDate(utcTimestamp)
    const year = parseInt(dateStr.slice(0, 4))
    const month = parseInt(dateStr.slice(5, 7))
    const lastDay = new Date(year, month, 0).getDate()
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * 获取业务日期对应的 UTC 时间范围（用于数据库查询）
 * 
 * @param dateStr 业务日期 (YYYY-MM-DD)
 * @returns UTC 时间范围的起止时间戳 (毫秒)
 */
export function getBusinessDayUtcRange(dateStr: string): { startUtc: number; endUtc: number } {
    // 业务日期的 00:00:00 UTC+4 = UTC 的前一天 20:00:00
    const [year, month, day] = dateStr.split('-').map(Number)
    const businessMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
    const startUtc = businessMidnight.getTime() - BUSINESS_TIMEZONE_OFFSET_MS
    const endUtc = startUtc + 24 * 60 * 60 * 1000 - 1
    return { startUtc, endUtc }
}

/**
 * 将 UTC 时间戳转换为业务时区的时间对象
 */
export function toBusinessTime(utcTimestamp: number): Date {
    return new Date(utcTimestamp + BUSINESS_TIMEZONE_OFFSET_MS)
}

/**
 * 将业务时区的日期时间字符串转换为 UTC 时间戳
 * 
 * @param dateTimeStr 业务时区日期时间 (YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss)
 */
export function businessTimeToUtc(dateTimeStr: string): number {
    // 标准化输入格式
    const normalized = dateTimeStr.length === 10
        ? dateTimeStr + 'T00:00:00'
        : dateTimeStr.replace(' ', 'T')

    const localDate = new Date(normalized + 'Z') // 解析为 UTC
    return localDate.getTime() - BUSINESS_TIMEZONE_OFFSET_MS
}

/**
 * 格式化时间戳为业务时区显示格式
 * 
 * @param timestamp UTC 时间戳 (毫秒)
 * @param format 格式: 'date' | 'datetime' | 'time'
 */
export function formatBusinessTime(timestamp: number, format: 'date' | 'datetime' | 'time' = 'datetime'): string {
    const businessTime = toBusinessTime(timestamp)
    const isoStr = businessTime.toISOString()

    switch (format) {
        case 'date':
            return isoStr.slice(0, 10)
        case 'time':
            return isoStr.slice(11, 19)
        case 'datetime':
        default:
            return isoStr.slice(0, 19).replace('T', ' ')
    }
}

/**
 * 获取业务时区名称显示
 */
export function getBusinessTimezoneDisplay(): string {
    return `UTC+${BUSINESS_TIMEZONE_OFFSET} (迪拜时间)`
}
