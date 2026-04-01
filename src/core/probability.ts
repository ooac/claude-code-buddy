import { RARITY_WEIGHTS, type Rarity, type RollFilters, SPECIES } from './types.js'

const SHINY_RATE = 0.01
const SPECIES_RATE = 1 / SPECIES.length

export function rarityProbability(rarity: Rarity): number {
  const total = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
  return RARITY_WEIGHTS[rarity] / total
}

export function rareOrBetterProbability(): number {
  return rarityProbability('rare') + rarityProbability('epic') + rarityProbability('legendary')
}

export function combinedProbability(filters: RollFilters): number {
  let probability = 1

  if (filters.rarity) {
    probability *= rarityProbability(filters.rarity)
  }
  if (filters.species) {
    probability *= SPECIES_RATE
  }
  if (typeof filters.shiny === 'boolean') {
    probability *= filters.shiny ? SHINY_RATE : 1 - SHINY_RATE
  }

  return probability
}

export function expectedAttempts(probability: number): number {
  if (probability <= 0) {
    return Number.POSITIVE_INFINITY
  }
  return 1 / probability
}

export function formatPercent(probability: number): string {
  return `${(probability * 100).toFixed(6)}%`
}
