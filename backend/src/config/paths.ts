export const PUBLIC_PATHS = new Set([
  // 系统路径（非业务 API）
  '/api/health',
  '/api/version',
  '/api/doc',
  '/api/ui',
  // V2 API 公开路径 (同时支持 /api 和 /api/v2 前缀)
  // Cloudflare Access 登录（使用 CF Access JWT 而非普通 JWT）
  '/api/auth/cf-session',
  '/api/v2/auth/cf-session',
])

export function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) { return true }
  // 可以添加其他逻辑，例如前缀匹配
  // if (path.startsWith('/api/public/')) return true
  return false
}
