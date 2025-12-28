import { Context, Next } from 'hono'
import type { Env, AppVariables } from '../types/index.js'

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

// Access 配置
const ACCESS_TEAM_DOMAIN = 'bingyizhou6u.cloudflareaccess.com'
const ACCESS_AUD = '391a8ccf810437fb09d8216696063ae175eaf8b7eeea72ccb873d658b6aa058d'

// 缓存 JWKS 公钥
let jwksCache: JwksResponse | null = null
let jwksCacheTime = 0
const JWKS_CACHE_TTL = 3600000 // 1 小时

/**
 * 获取 Cloudflare Access 的 JWKS 公钥
 */
async function getJwks(): Promise<JwksResponse> {
    const now = Date.now()
    if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
        return jwksCache
    }

    const response = await fetch(`https://${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
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
async function verifyCfAccessJwt(token: string): Promise<CfAccessJwtPayload> {
    const parts = token.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // 解析 header 获取 kid
    const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64))
    const header = JSON.parse(headerJson) as { kid: string; alg: string }

    // 解析 payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64))
    const payload = JSON.parse(payloadJson) as CfAccessJwtPayload

    // 验证 aud
    if (!payload.aud || !payload.aud.includes(ACCESS_AUD)) {
        throw new Error('Invalid audience')
    }

    // 验证 exp
    if (payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired')
    }

    // 验证 iss
    if (payload.iss !== `https://${ACCESS_TEAM_DOMAIN}`) {
        throw new Error('Invalid issuer')
    }

    // 获取公钥
    const jwks = await getJwks()
    const jwk = jwks.keys.find(k => k.kid === header.kid)
    if (!jwk) {
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
        throw new Error('Invalid signature')
    }

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

        try {
            const payload = await verifyCfAccessJwt(jwtToken)
            c.set('cfAccessEmail', payload.email)
            c.set('cfAccessSub', payload.sub)
            return next()
        } catch (error) {
            console.error('CF Access JWT verification failed:', error)
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
            try {
                const payload = await verifyCfAccessJwt(jwtToken)
                c.set('cfAccessEmail', payload.email)
                c.set('cfAccessSub', payload.sub)
            } catch (error) {
                console.warn('CF Access JWT verification failed:', error)
            }
        }

        return next()
    }
}
