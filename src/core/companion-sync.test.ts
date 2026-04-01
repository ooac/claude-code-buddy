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

  it('构建同步 companion 仅写入 soul，并清理旧 bones 字段', () => {
    const userId = 'sync-user-001'
    const { bones } = rollByUserId(userId)

    const synced = buildSyncedCompanion(userId, bones, {
      name: 'OldBuddy',
      personality: 'A common blob of few words.',
      hatchedAt: 1,
      rarity: 'legendary',
      species: 'dragon',
      eye: '✦',
      hat: 'wizard',
      shiny: true,
      stats: {
        DEBUGGING: 100,
        PATIENCE: 100,
        CHAOS: 100,
        WISDOM: 100,
        SNARK: 100,
      },
    })

    expect(synced.name).not.toBe('OldBuddy')
    expect(typeof synced.name).toBe('string')
    expect((synced.name as string).length).toBeGreaterThan(3)
    expect(synced.rarity).toBeUndefined()
    expect(synced.species).toBeUndefined()
    expect(synced.eye).toBeUndefined()
    expect(synced.hat).toBeUndefined()
    expect(synced.shiny).toBeUndefined()
    expect(synced.stats).toBeUndefined()
    expect(typeof synced.personality).toBe('string')
    expect((synced.personality as string).toLowerCase()).toContain(bones.rarity)
    expect((synced.personality as string).toLowerCase()).toContain(bones.species)
    expect(Object.keys(synced).sort()).toEqual(['hatchedAt', 'name', 'personality'])
  })
})
