import { describe, expect, it } from 'vitest'
import { getHashMode, hashString, hashStringBunCompat, hashStringFNV1a } from './seed.js'

describe('seed hash mode', () => {
  it('bun 兼容哈希与 FNV 哈希结果不同', () => {
    const input = 'user-001friend-2026-401'
    expect(hashStringBunCompat(input)).toBe(4257287171)
    expect(hashStringFNV1a(input)).toBe(2420412031)
    expect(hashStringBunCompat(input)).not.toBe(hashStringFNV1a(input))
  })

  it('默认哈希模式为 bun 兼容', () => {
    const original = process.env.BUDDY_HASH_MODE
    delete process.env.BUDDY_HASH_MODE
    try {
      expect(getHashMode()).toBe('bun')
      expect(hashString('abc')).toBe(hashStringBunCompat('abc'))
    } finally {
      if (typeof original === 'string') {
        process.env.BUDDY_HASH_MODE = original
      } else {
        delete process.env.BUDDY_HASH_MODE
      }
    }
  })

  it('设置 BUDDY_HASH_MODE=fnv 时可切换回 FNV', () => {
    const original = process.env.BUDDY_HASH_MODE
    process.env.BUDDY_HASH_MODE = 'fnv'
    try {
      expect(getHashMode()).toBe('fnv')
      expect(hashString('abc')).toBe(hashStringFNV1a('abc'))
    } finally {
      if (typeof original === 'string') {
        process.env.BUDDY_HASH_MODE = original
      } else {
        delete process.env.BUDDY_HASH_MODE
      }
    }
  })
})
