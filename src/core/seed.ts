import { hash as bunWyhash } from 'bun-wyhash'

export type HashMode = 'bun_exact' | 'fnv'

// 精确兼容 Bun.hash：取 64 位哈希的低 32 位。
export function hashStringBunExact(input: string): number {
  // bun-wyhash 的类型声明是 number，但实际返回 bigint（与 Bun.hash 对齐）。
  const hash64 = bunWyhash(input) as unknown as bigint
  return Number(BigInt.asUintN(32, hash64))
}

// 向后兼容旧函数名（避免调用方一次性改动过大）。
export const hashStringBunCompat = hashStringBunExact

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
  const raw = (process.env.BUDDY_HASH_MODE ?? 'bun_exact').trim().toLowerCase()
  if (raw === 'fnv') {
    return 'fnv'
  }
  // 兼容旧值 `bun`，统一归一到 `bun_exact`
  return 'bun_exact'
}

export function getHashMode(): HashMode {
  return resolveHashMode()
}

export function hashString(input: string, mode = resolveHashMode()): number {
  if (mode === 'fnv') {
    return hashStringFNV1a(input)
  }
  return hashStringBunExact(input)
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
