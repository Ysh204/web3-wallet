import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha2'

const SEED_KEY = new TextEncoder().encode('ed25519 seed')

function parsePath(path: string): number[] {
    if (!path.startsWith('m')) throw new Error('Path must start with "m"')
    return path
        .split('/')
        .slice(1)
        .map((seg) => {
            const idx = parseInt(seg.replace(/['h]$/, ''), 10)
            if (Number.isNaN(idx)) throw new Error('Invalid path segment: ' + seg)
            return (idx | 0x80000000) >>> 0
        })
}

export function derivePath(seed: Uint8Array, path: string) {
    const master = hmac(sha512, seed, SEED_KEY)
    let key = master.slice(0, 32)
    let chainCode = master.slice(32)

    for (const index of parsePath(path)) {
        const buf = new Uint8Array(37)
        buf.set(key, 1)
        new DataView(buf.buffer).setUint32(33, index, false)
        const I = hmac(sha512, buf, chainCode)
        key = I.slice(0, 32)
        chainCode = I.slice(32)
    }

    return { key, chainCode }
}
