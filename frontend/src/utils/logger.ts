/**
 * 前端日志工具
 * 
 * 统一的日志接口，支持：
 * - 开发环境输出到 console
 * - 生产环境静默或发送到外部服务
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
    level: LogLevel
    message: string
    data?: unknown
    timestamp: string
}

// 判断是否为开发环境
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

// 敏感字段列表
const SENSITIVE_KEYS = new Set([
    'password',
    'token',
    'secret',
    'authorization',
    'totp',
    'totpSecret',
    'totpCode',
])

/**
 * 脱敏处理
 */
function sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
        return data
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitize(item))
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            sanitized[key] = '******'
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitize(value)
        } else {
            sanitized[key] = value
        }
    }
    return sanitized
}

/**
 * 格式化日志输出
 */
function formatLog(entry: LogEntry): string {
    const parts = [`[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`]
    if (entry.data) {
        parts.push(JSON.stringify(sanitize(entry.data), null, 2))
    }
    return parts.join('\n')
}

/**
 * 创建日志条目
 */
function createEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
    }
}

/**
 * 前端 Logger
 */
export const Logger = {
    /**
     * Debug 级别日志（仅开发环境）
     */
    debug(message: string, data?: unknown): void {
        if (!isDev) return
        const entry = createEntry('debug', message, data)
        console.debug(formatLog(entry))
    },

    /**
     * Info 级别日志
     */
    info(message: string, data?: unknown): void {
        const entry = createEntry('info', message, data)
        console.info(formatLog(entry))
    },

    /**
     * Warn 级别日志
     */
    warn(message: string, data?: unknown): void {
        const entry = createEntry('warn', message, data)
        console.warn(formatLog(entry))
    },

    /**
     * Error 级别日志
     */
    error(message: string, data?: unknown): void {
        const entry = createEntry('error', message, data)
        console.error(formatLog(entry))

        // TODO: 生产环境可发送到外部监控服务
        // if (!isDev) {
        //   sendToMonitoring(entry)
        // }
    },

    /**
     * 断言日志 - 条件为 false 时输出错误
     */
    assert(condition: boolean, message: string, data?: unknown): void {
        if (!condition) {
            this.error(`Assertion failed: ${message}`, data)
        }
    },
}

export default Logger
