/* eslint-disable */
// shim for webcrypto in node
const { webcrypto } = require('node:crypto');
if (!global.crypto) {
    global.crypto = webcrypto;
}

async function hashPassword(password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        256 // 256 bits = 32 bytes
    );

    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `pbkdf2$100000$${saltHex}$${hashHex}`;
}

hashPassword('Qq1234').then(hash => console.log(hash));
