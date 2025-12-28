/**
 * Web Crypto API based Password Hashing (PBKDF2)
 * Optimized for Cloudflare Workers Environment
 */

export async function hashPassword(password: string): Promise<string> {
    const enc = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    )

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256 // 256 bits = 32 bytes
    )

    const saltHex = Array.from(salt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    const hashHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

    return `pbkdf2$100000$${saltHex}$${hashHex}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Format: pbkdf2$iterations$salt$hash
    const parts = storedHash.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
        return false
    }

    const iterations = parseInt(parts[1], 10)
    const saltHex = parts[2]
    const originalHashHex = parts[3]

    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))

    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    )

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    )

    const hashHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

    return hashHex === originalHashHex
}
