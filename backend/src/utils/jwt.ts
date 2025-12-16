const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  const nodeBuffer = (globalThis as any).Buffer
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64')
  }
  throw new Error('Base64 encoding not supported in this environment')
}

function base64ToBytes(base64: string) {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const nodeBuffer = (globalThis as any).Buffer
  if (nodeBuffer) {
    return nodeBuffer.from(base64, 'base64')
  }
  throw new Error('Base64 decoding not supported in this environment')
}

function base64UrlEncode(data: string | Uint8Array) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(str: string) {
  const padLength = (4 - (str.length % 4 || 4)) % 4
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength)
  return base64ToBytes(base64)
}

async function getKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export const AUTH_COOKIE_NAME = 'caiwu_auth'
export const AUTH_HEADER_NAME = 'Authorization'
export const ALT_AUTH_HEADER = 'x-caiwu-token'
export const AUTH_TOKEN_TTL = 60 * 60 * 2 // 2 hours

export type AuthTokenPayload = {
  sid: string
  sub: string
  email: string
  name: string
  role?: string // 可选，从 position 中推导
  position?: any
  iat?: number
  exp?: number
}

export async function signAuthToken(
  payload: AuthTokenPayload,
  secret: string,
  ttlSeconds = AUTH_TOKEN_TTL
) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const issuedAt = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const data = `${encodedHeader}.${encodedPayload}`

  const key = await getKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const encodedSignature = base64UrlEncode(new Uint8Array(signature))

  return `${data}.${encodedSignature}`
}

export async function verifyAuthToken(token: string, secret: string): Promise<AuthTokenPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const data = `${encodedHeader}.${encodedPayload}`

  const key = await getKey(secret)
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(encodedSignature),
    encoder.encode(data)
  )
  if (!isValid) {
    throw new Error('Invalid token signature')
  }

  const payloadJson = decoder.decode(base64UrlDecode(encodedPayload))
  const payload = JSON.parse(payloadJson)

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return payload
}

export function extractBearerToken(header?: string | null) {
  if (!header) {return null}
  const [type, token] = header.split(' ')
  if (!token || type.toLowerCase() !== 'bearer') {return null}
  return token.trim()
}
