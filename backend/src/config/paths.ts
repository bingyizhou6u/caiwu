
export const PUBLIC_PATHS = new Set([
    '/api/health',
    '/api/init-if-empty',
    '/api/auth/login',
    '/api/auth/login-password',
    '/api/auth/activate',
    '/api/auth/activate/verify',
    '/api/auth/generate-totp-for-activation',
    '/api/auth/reset-password/verify',
    '/api/auth/reset-password',
    '/api/auth/me',
    '/api/me',
    '/api/system-config/email-notification/enabled',
    '/api/doc',
    '/api/ui'
])

export function isPublicPath(path: string): boolean {
    if (PUBLIC_PATHS.has(path)) return true
    // 可以添加其他逻辑，例如前缀匹配
    // if (path.startsWith('/api/public/')) return true
    return false
}
