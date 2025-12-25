/**
 * 业务时区工具函数 (前端)
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
 * 获取当前业务时区的年份
 */
export function getBusinessYear(utcTimestamp?: number): number {
    const dateStr = getBusinessDate(utcTimestamp)
    return parseInt(dateStr.slice(0, 4))
}

/**
 * 获取当前业务时区的月份 (1-12)
 */
export function getBusinessMonth(utcTimestamp?: number): number {
    const dateStr = getBusinessDate(utcTimestamp)
    return parseInt(dateStr.slice(5, 7))
}


/**
 * 将 UTC 时间戳转换为业务时区的时间对象
 */
export function toBusinessTime(utcTimestamp: number): Date {
    return new Date(utcTimestamp + BUSINESS_TIMEZONE_OFFSET_MS)
}

/**
 * 格式化时间戳为业务时区显示格式
 * 
 * @param timestamp UTC 时间戳 (毫秒)
 * @param format 格式类型
 */
export function formatBusinessTime(
    timestamp: number,
    format: 'date' | 'datetime' | 'time' = 'datetime'
): string {
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
 * 格式化时间戳，同时显示业务时区和用户本地时间
 * 
 * @param timestamp UTC 时间戳 (毫秒)
 * @param showLocal 是否同时显示本地时间
 */
export function formatDualTime(timestamp: number, showLocal = true): { business: string; local?: string } {
    const business = formatBusinessTime(timestamp, 'datetime')

    if (showLocal) {
        const localTime = new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
        return { business, local: localTime }
    }

    return { business }
}

/**
 * 获取业务时区名称显示
 */
export function getBusinessTimezoneDisplay(): string {
    return 'UTC+4 (迪拜时间)'
}

/**
 * 获取用户本地时区偏移（小时）
 */
export function getLocalTimezoneOffset(): number {
    return -new Date().getTimezoneOffset() / 60
}

/**
 * 获取用户本地时区显示
 */
export function getLocalTimezoneDisplay(): string {
    const offset = getLocalTimezoneOffset()
    const sign = offset >= 0 ? '+' : ''
    return `UTC${sign}${offset}`
}
