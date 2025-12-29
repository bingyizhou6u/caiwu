import { Context, Next } from 'hono'
import type { Env, AppVariables } from '../types/index.js'
import { Logger } from '../utils/logger.js'

/**
 * Cloudflare Access JWT 验证中间件
 * 
 * 验证 CF-Access-JWT-Assertion 头部中的 JWT，
 * 并将用户信息（邮箱）添加到请求上下文中
 */

interface CfAccessJwtPayload {
    aud: string[]
    email: string
    exp: number
    iat: number
    iss: string
    sub: string
    type: string
    country?: string
}

interface JwkKey {
    kid: string
    kty: string
    alg: string
    use: string
    e: string
    n: string
}

interface JwksResponse {
    keys: JwkKey[]
}

// 缓存 JWKS 公钥
let jwksCache: JwksResponse | null = null
let jwksCacheTime = 0
const JWKS_CACHE_TTL = 3600000 // 1 小时

/**
 * 获取 Cloudflare Access 的 JWKS 公钥
 */
async function getJwks(accessTeamDomain: string): Promise<JwksResponse> {
    const now = Date.now()
    if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
        return jwksCache
    }

    const response = await fetch(`https://${accessTeamDomain}/cdn-cgi/access/certs`)
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`)
    }

    jwksCache = await response.json() as JwksResponse
    jwksCacheTime = now
    return jwksCache
}

/**
 * 将 JWK 转换为 CryptoKey
 */
async function importJwk(jwk: JwkKey): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'jwk',
        {
            kty: jwk.kty,
            e: jwk.e,
            n: jwk.n,
            alg: jwk.alg,
            use: jwk.use,
        },
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['verify']
    )
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(str: string): Uint8Array {
    // 补齐 padding
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

/**
 * 验证 Cloudflare Access JWT
 */
async function verifyCfAccessJwt(
    token: string,
    accessTeamDomain: string,
    accessAud: string
): Promise<CfAccessJwtPayload> {
    Logger.debug('[CF Access] Starting JWT verification')

    const parts = token.split('.')
    if (parts.length !== 3) {
        Logger.error('[CF Access] Invalid JWT format', { parts: parts.length })
        throw new Error('Invalid JWT format')
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // 解析 header 获取 kid
    const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64))
    const header = JSON.parse(headerJson) as { kid: string; alg: string }
    Logger.debug('[CF Access] Header parsed', { kid: header.kid, alg: header.alg })

    // 解析 payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64))
    const payload = JSON.parse(payloadJson) as CfAccessJwtPayload
    Logger.debug('[CF Access] Payload parsed', { email: payload.email, iss: payload.iss, aud: payload.aud, expectedAud: accessAud })

    // 验证 aud (支持字符串或数组)
    const audMatch = Array.isArray(payload.aud)
        ? payload.aud.includes(accessAud)
        : payload.aud === accessAud
    if (!audMatch) {
        Logger.error('[CF Access] AUD mismatch', { tokenAud: payload.aud, expectedAud: accessAud })
        throw new Error('Invalid audience')
    }

    // 验证 exp
    if (payload.exp * 1000 < Date.now()) {
        Logger.error('[CF Access] Token expired', { expiredAt: new Date(payload.exp * 1000).toISOString() })
        throw new Error('Token expired')
    }

    // 验证 iss
    const expectedIss = `https://${accessTeamDomain}`
    if (payload.iss !== expectedIss) {
        Logger.error('[CF Access] Issuer mismatch', { got: payload.iss, expected: expectedIss })
        throw new Error('Invalid issuer')
    }

    // 获取公钥
    const jwks = await getJwks(accessTeamDomain)
    const jwk = jwks.keys.find(k => k.kid === header.kid)
    if (!jwk) {
        Logger.error('[CF Access] Public key not found', { kid: header.kid, availableKids: jwks.keys.map(k => k.kid) })
        throw new Error('Public key not found')
    }

    // 验证签名
    const key = await importJwk(jwk)
    const signatureBytes = base64UrlDecode(signatureB64)
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

    const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        signatureBytes.buffer as ArrayBuffer,
        dataBytes
    )

    if (!valid) {
        Logger.error('[CF Access] Signature verification failed')
        throw new Error('Invalid signature')
    }

    Logger.info('[CF Access] JWT verification successful', { email: payload.email })
    return payload
}

/**
 * Cloudflare Access 认证中间件
 * 
 * 验证 CF-Access-JWT-Assertion 头部，将用户邮箱添加到上下文
 */
export function cloudflareAccessAuth() {
    return async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
        const jwtToken = c.req.header('CF-Access-JWT-Assertion')

        if (!jwtToken) {
            // 没有 CF Access Token，返回 401 让 CF Access 处理
            return c.json({
                success: false,
                error: 'Access denied. Please authenticate via Cloudflare Access.',
                code: 'CF_ACCESS_REQUIRED'
            }, 401)
        }

        // 从环境变量读取配置（必需）
        const accessTeamDomain = c.env.CF_ACCESS_TEAM_DOMAIN
        const accessAud = c.env.CF_ACCESS_AUD
        if (!accessTeamDomain || !accessAud) {
            Logger.error('CF Access config missing', { hasTeamDomain: !!accessTeamDomain, hasAud: !!accessAud })
            return c.json({
                success: false,
                error: 'Server configuration error: CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are required',
                code: 'CF_ACCESS_CONFIG_MISSING'
            }, 500)
        }

        try {
            const payload = await verifyCfAccessJwt(jwtToken, accessTeamDomain, accessAud)
            c.set('cfAccessEmail', payload.email)
            c.set('cfAccessSub', payload.sub)
            return next()
        } catch (error) {
            Logger.error('CF Access JWT verification failed', { error: error instanceof Error ? error.message : String(error) }, c)
            return c.json({
                success: false,
                error: 'Invalid Cloudflare Access token',
                code: 'CF_ACCESS_INVALID'
            }, 401)
        }
    }
}

/**
 * 可选的 CF Access 认证（用于既支持 CF Access 又支持传统 JWT 的端点）
 */
export function optionalCfAccessAuth() {
    return async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
        const jwtToken = c.req.header('CF-Access-JWT-Assertion')

        if (jwtToken) {
            // 从环境变量读取配置（必需）
            const accessTeamDomain = c.env.CF_ACCESS_TEAM_DOMAIN
            const accessAud = c.env.CF_ACCESS_AUD
            if (!accessTeamDomain || !accessAud) {
                Logger.warn('CF Access config missing, skipping optional auth')
                return next()
            }

            try {
                const payload = await verifyCfAccessJwt(jwtToken, accessTeamDomain, accessAud)
                c.set('cfAccessEmail', payload.email)
                c.set('cfAccessSub', payload.sub)
            } catch (error) {
                Logger.warn('CF Access JWT verification failed', { error: error instanceof Error ? error.message : String(error) }, c)
            }
        }

        return next()
    }
}
