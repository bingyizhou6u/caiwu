
export const PUBLIC_PATHS = new Set([
    '/api/health',
    '/api/init-if-empty',
    '/api/auth/login',
    '/api/auth/login-password',
    '/api/auth/change-password-first',
    '/api/auth/get-totp-qr',
    '/api/auth/bind-totp-first',
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
