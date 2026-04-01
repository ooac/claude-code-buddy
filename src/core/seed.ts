import { wyhash_str } from 'wyhash'

export type HashMode = 'bun' | 'fnv'

// 兼容 Bun.hash：内部是 wyhash64，这里取低 32 位。
export function hashStringBunCompat(input: string): number {
  const hash64 = wyhash_str(input, 0n)
  return Number(BigInt.asUintN(32, hash64))
}

// FNV-1a 32 位哈希（兼容回退模式）
export function hashStringFNV1a(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function resolveHashMode(): HashMode {
  const raw = (process.env.BUDDY_HASH_MODE ?? 'bun').trim().toLowerCase()
  return raw === 'fnv' ? 'fnv' : 'bun'
}

export function getHashMode(): HashMode {
  return resolveHashMode()
}

export function hashString(input: string, mode = resolveHashMode()): number {
  if (mode === 'fnv') {
    return hashStringFNV1a(input)
  }
  return hashStringBunCompat(input)
}

// Mulberry32 伪随机数生成器
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
