/**
 * 安全响应头中间件
 * 设置各种安全相关的 HTTP 响应头，提升应用安全性
 */
import { Context, Next, MiddlewareHandler } from 'hono'
import type { Env, AppVariables } from '../types/index.js'

/**
 * 安全响应头中间件
 * 设置以下安全头：
 * - X-Content-Type-Options: 防止 MIME 类型嗅探
 * - X-Frame-Options: 防止点击劫持
 * - X-XSS-Protection: 启用浏览器 XSS 过滤器
 * - Strict-Transport-Security: 强制 HTTPS
 * - Content-Security-Policy: 内容安全策略
 * - Referrer-Policy: 控制 referrer 信息
 * - Permissions-Policy: 控制浏览器功能权限
 */
export function securityHeaders(): MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> {
  return async (c: Context, next: Next) => {
    await next()

    // X-Content-Type-Options: 防止浏览器 MIME 类型嗅探
    c.header('X-Content-Type-Options', 'nosniff')

    // X-Frame-Options: 防止页面被嵌入到 iframe 中（防止点击劫持）
    c.header('X-Frame-Options', 'DENY')

    // X-XSS-Protection: 启用浏览器内置的 XSS 过滤器
    c.header('X-XSS-Protection', '1; mode=block')

    // Strict-Transport-Security: 强制使用 HTTPS（1年有效期，包含子域名）
    // 注意：仅在 HTTPS 连接时设置此头
    if (c.req.url.startsWith('https://')) {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    // Content-Security-Policy: 内容安全策略
    // 默认只允许同源资源，允许内联脚本和样式（Ant Design 5.x 需要 unsafe-inline）
    // 允许 Cloudflare 的 CDN 和图片服务
    // 注意：如果前端部署在 Cloudflare Pages，需要允许 cloudflarets.com 域名
    // Ant Design 5.x 不需要 unsafe-eval，已移除以提高安全性
    // 如果遇到脚本执行错误，可以临时添加 'unsafe-eval'，但应优先排查问题根源
    const csp = [
      "default-src 'self' https://cloudflarets.com",
      "script-src 'self' 'unsafe-inline' https://cloudflarets.com https://*.cloudflare.com",
      "script-src-elem 'self' 'unsafe-inline' https://cloudflarets.com https://*.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cloudflarets.com",
      "font-src 'self' https://fonts.gstatic.com data: https://cloudflarets.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.cloudflare.com https://cloudflarets.com wss://cloudflarets.com",
      "worker-src 'self' blob: https://cloudflarets.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
    c.header('Content-Security-Policy', csp)

    // Referrer-Policy: 控制 referrer 信息的发送
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions-Policy: 控制浏览器功能权限
    // 禁用不常用的功能以提高安全性
    const permissionsPolicy = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'speaker=()',
      'vibrate=()',
      'fullscreen=(self)',
      'sync-xhr=(self)',
    ].join(', ')
    c.header('Permissions-Policy', permissionsPolicy)

    // X-Permitted-Cross-Domain-Policies: 控制跨域策略文件
    c.header('X-Permitted-Cross-Domain-Policies', 'none')
  }
}
