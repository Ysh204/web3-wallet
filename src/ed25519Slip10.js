

import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

const ED25519_SEED = new TextEncoder().encode('ed25519 seed')

function hmacSha512(key, data) {
  return hmac(sha512, data, key) 
}

function parsePath(path) {
  if (!path.startsWith('m')) throw new Error('Path must start with "m"')
  const parts = path.split('/').slice(1)
  return parts.map((p) => {
    const hardened = p.endsWith(`'`) || p.endsWith('h')
    const index = parseInt(hardened ? p.slice(0, -1) : p, 10)
    if (Number.isNaN(index)) throw new Error('Invalid path segment: ' + p)

    return (index | 0x80000000) >>> 0
  })
}

/**

 * @param {Uint8Array} seed 
 * @param {string} path 
 * @returns {{ key: Uint8Array(32), chainCode: Uint8Array(32) }}
 */
export function derivePath(seed, path) {
 
  const I = hmacSha512(ED25519_SEED, seed)
  let privKey = I.slice(0, 32) 
  let chainCode = I.slice(32, 64)

  const indices = parsePath(path)
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
  
    const data = new Uint8Array(1 + privKey.length + 4)
    data[0] = 0x00
    data.set(privKey, 1)
 
    data[data.length - 4] = (index >>> 24) & 0xff
    data[data.length - 3] = (index >>> 16) & 0xff
    data[data.length - 2] = (index >>> 8) & 0xff
    data[data.length - 1] = index & 0xff

    const I2 = hmacSha512(chainCode, data)
    privKey = I2.slice(0, 32)
    chainCode = I2.slice(32, 64)
  }

  return { key: privKey, chainCode }
}
