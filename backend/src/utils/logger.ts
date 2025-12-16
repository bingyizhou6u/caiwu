import { Context } from 'hono'

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

interface LogEntry {
  timestamp: string
  level: LogLevel
  requestId: string
  userId?: string
  ip?: string
  message: string
  data?: any
}

export class Logger {
  // List of keys to mask
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'password_confirmation',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'api_key',
    'authorization',
    'cookie',
    'totp',
    'totpSecret',
    'totpCode',
  ])

  private static sanitize(data: any): any {
    if (!data) {return data}
    if (typeof data === 'string') {return data}
    if (typeof data !== 'object') {return data}

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item))
    }

    const sanitized: any = {}
    for (const key of Object.keys(data)) {
      if (this.SENSITIVE_KEYS.has(key) || this.SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '******'
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        sanitized[key] = this.sanitize(data[key])
      } else {
        sanitized[key] = data[key]
      }
    }
    return sanitized
  }

  static getContext(c?: Context): Partial<LogEntry> {
    if (!c) {return {}}
    return {
      requestId: c.get('requestId') || 'unknown',
      userId: c.get('userId'),
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-real-ip'),
    }
  }

  static log(level: LogLevel, message: string, data?: any, c?: Context) {
    const context = this.getContext(c)

    // In Workers environment, we print JSON line
    // This allows Cloudflare or external loggers to parse it easily
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: context.requestId ?? 'system',
      userId: context.userId,
      ip: context.ip,
      message,
      data: this.sanitize(data),
    }

    const output = JSON.stringify(entry)

    switch (level) {
      case 'ERROR':
        console.error(output)
        break
      case 'WARN':
        console.warn(output)
        break
      case 'INFO':
      case 'DEBUG':
      default:
        console.log(output)
        break
    }
  }

  static info(message: string, data?: any, c?: Context) {
    this.log('INFO', message, data, c)
  }

  static warn(message: string, data?: any, c?: Context) {
    this.log('WARN', message, data, c)
  }

  static error(message: string, data?: any, c?: Context) {
    this.log('ERROR', message, data, c)
  }

  static debug(message: string, data?: any, c?: Context) {
    this.log('DEBUG', message, data, c)
  }
}
