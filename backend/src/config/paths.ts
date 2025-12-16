export const PUBLIC_PATHS = new Set([
  // 系统路径（非业务 API）
  '/api/health',
  '/api/version',
  '/api/doc',
  '/api/ui',
  // V2 API 公开路径
  '/api/v2/auth/login',
  '/api/v2/auth/me',
  '/api/v2/init-if-empty',
  '/api/v2/auth/activate',
  '/api/v2/auth/activate/verify',
  '/api/v2/auth/generate-totp-for-activation',
  '/api/v2/auth/reset-password/verify',
  '/api/v2/auth/reset-password',
  '/api/v2/auth/mobile/request-totp-reset',
  '/api/v2/auth/mobile/reset-totp/verify',
  '/api/v2/auth/mobile/reset-totp/confirm',
])

export function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) {return true}
  // 可以添加其他逻辑，例如前缀匹配
  // if (path.startsWith('/api/public/')) return true
  return false
}
