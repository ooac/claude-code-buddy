import { describe, expect, it } from 'vitest'
import { buildSyncedCompanion, extractCompanionSignature } from './companion-sync.js'
import { rollByUserId } from './buddy-engine.js'

describe('companion-sync', () => {
  it('可从 personality 解析旧 companion 的稀有度与物种', () => {
    const signature = extractCompanionSignature({
      name: 'Crumpet',
      personality: 'A common blob of few words.',
      hatchedAt: Date.now(),
    })

    expect(signature.source).toBe('personality')
    expect(signature.rarity).toBe('common')
    expect(signature.species).toBe('blob')
  })

  it('构建同步 companion 会写入骨架字段', () => {
    const userId = 'sync-user-001'
    const { bones } = rollByUserId(userId)

    const synced = buildSyncedCompanion(userId, bones, {
      name: 'OldBuddy',
      personality: 'A common blob of few words.',
      hatchedAt: 1,
    })

    expect(synced.name).not.toBe('OldBuddy')
    expect(typeof synced.name).toBe('string')
    expect((synced.name as string).length).toBeGreaterThan(3)
    expect(synced.rarity).toBe(bones.rarity)
    expect(synced.species).toBe(bones.species)
    expect(synced.eye).toBe(bones.eye)
    expect(synced.hat).toBe(bones.hat)
    expect(synced.stats).toEqual(bones.stats)
    expect(typeof synced.personality).toBe('string')
    expect((synced.personality as string).toLowerCase()).toContain(bones.rarity)
    expect((synced.personality as string).toLowerCase()).toContain(bones.species)
  })
})
