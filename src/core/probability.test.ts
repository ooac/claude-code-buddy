import { describe, expect, it } from 'vitest'
import {
  combinedProbability,
  expectedAttempts,
  rareOrBetterProbability,
  rarityProbability,
} from './probability.js'

describe('probability', () => {
  it('稀有度概率正确', () => {
    expect(rarityProbability('common')).toBeCloseTo(0.6)
    expect(rarityProbability('legendary')).toBeCloseTo(0.01)
  })

  it('组合概率与期望抽数正确', () => {
    const p = combinedProbability({ rarity: 'legendary', species: 'capybara', shiny: true })
    expect(p).toBeCloseTo(1 / 18 / 100 / 100)
    expect(expectedAttempts(p)).toBeCloseTo(180000)
  })

  it('稀有及以上总概率为 15%', () => {
    expect(rareOrBetterProbability()).toBeCloseTo(0.15)
  })
})
