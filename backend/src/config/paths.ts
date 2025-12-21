export const PUBLIC_PATHS = new Set([
  // 系统路径（非业务 API）
  '/api/health',
  '/api/version',
  '/api/doc',
  '/api/ui',
  // V2 API 公开路径 (同时支持 /api 和 /api/v2 前缀)
  '/api/auth/login',
  '/api/v2/auth/login',
  '/api/auth/me',
  '/api/v2/auth/me',
  '/api/init-if-empty',
  '/api/v2/init-if-empty',
  '/api/auth/activate',
  '/api/v2/auth/activate',
  '/api/auth/activate/verify',
  '/api/v2/auth/activate/verify',
  '/api/auth/generate-totp-for-activation',
  '/api/v2/auth/generate-totp-for-activation',
  '/api/auth/reset-password/verify',
  '/api/v2/auth/reset-password/verify',
  '/api/auth/reset-password',
  '/api/v2/auth/reset-password',
  '/api/auth/mobile/request-totp-reset',
  '/api/v2/auth/mobile/request-totp-reset',
  '/api/auth/mobile/reset-totp/verify',
  '/api/v2/auth/mobile/reset-totp/verify',
  '/api/auth/mobile/reset-totp/confirm',
  '/api/v2/auth/mobile/reset-totp/confirm',
])

export function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) {return true}
  // 可以添加其他逻辑，例如前缀匹配
  // if (path.startsWith('/api/public/')) return true
  return false
}
