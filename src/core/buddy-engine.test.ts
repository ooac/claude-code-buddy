import { describe, expect, it } from 'vitest'
import { matchFilters, rollByUserId } from './buddy-engine.js'

describe('buddy-engine', () => {
  it('同一个 userId 结果应完全一致', () => {
    const first = rollByUserId('user-001')
    const second = rollByUserId('user-001')
    expect(first).toEqual(second)
  })

  it('不同 userId 通常会得到不同骨架', () => {
    const first = rollByUserId('user-alpha')
    const second = rollByUserId('user-beta')
    expect(first.bones).not.toEqual(second.bones)
  })

  it('过滤器匹配逻辑正确', () => {
    const { bones } = rollByUserId('user-filter')
    expect(
      matchFilters(bones, {
        rarity: bones.rarity,
        species: bones.species,
        shiny: bones.shiny,
      }),
    ).toBe(true)
    expect(matchFilters(bones, { shiny: !bones.shiny })).toBe(false)
  })
})
