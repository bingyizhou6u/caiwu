/**
 * 统一日志系统
 * 支持结构化日志输出，区分日志级别
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  userId?: string
  action?: string
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// 生产环境默认 info 级别，开发环境 debug 级别
const MIN_LOG_LEVEL: LogLevel = 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL]
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, context))
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context))
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error instanceof Error ? { 
          errorMessage: error.message,
          errorStack: error.stack 
        } : { errorDetail: String(error) })
      }
      console.error(formatMessage('error', message, errorContext))
    }
  },

  // 请求日志快捷方法
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { ...context, action: 'request' })
  },

  // 数据库操作日志
  db(operation: string, table: string, context?: LogContext): void {
    this.debug(`DB ${operation} on ${table}`, { ...context, action: 'database' })
  },

  // 认证日志
  auth(action: string, context?: LogContext): void {
    this.info(`Auth: ${action}`, { ...context, action: 'auth' })
  }
}

export default logger
