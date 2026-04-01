import { randomBytes } from 'node:crypto'
import { hashString, mulberry32 } from './seed.js'
import {
  BUDDY_SALT,
  type BuddyBones,
  type BuddyRoll,
  EYES,
  HATS,
  RARITIES,
  RARITY_FLOOR,
  RARITY_WEIGHTS,
  type Rarity,
  type RollFilters,
  SPECIES,
  STAT_NAMES,
  type StatName,
} from './types.js'

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

export function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
  let roll = rng() * total
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity]
    if (roll < 0) {
      return rarity
    }
  }
  return 'common'
}

function rollStats(rng: () => number, rarity: Rarity): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES)
  while (dump === peak) {
    dump = pick(rng, STAT_NAMES)
  }

  const stats = {} as Record<StatName, number>
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15))
    } else {
      stats[name] = floor + Math.floor(rng() * 40)
    }
  }
  return stats
}

function rollFromRng(rng: () => number): BuddyRoll {
  const rarity = rollRarity(rng)
  const bones: BuddyBones = {
    rarity,
    species: pick(rng, SPECIES),
    eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  }

  return {
    bones,
    inspirationSeed: Math.floor(rng() * 1_000_000_000),
  }
}

export function rollWithSeed(seed: string): BuddyRoll {
  return rollFromRng(mulberry32(hashString(seed)))
}

export function rollByUserId(userId: string): BuddyRoll {
  return rollWithSeed(`${userId}${BUDDY_SALT}`)
}

export function createRandomUserId(): string {
  return randomBytes(32).toString('hex')
}

export function matchFilters(bones: BuddyBones, filters: RollFilters): boolean {
  if (filters.rarity && bones.rarity !== filters.rarity) {
    return false
  }
  if (filters.species && bones.species !== filters.species) {
    return false
  }
  if (typeof filters.shiny === 'boolean' && bones.shiny !== filters.shiny) {
    return false
  }
  return true
}

export function findUserIdByFilters(
  filters: RollFilters,
  maxAttempts: number,
): { userId: string; roll: BuddyRoll; attempts: number } {
  if (maxAttempts <= 0) {
    throw new Error('maxAttempts 必须大于 0')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userId = createRandomUserId()
    const roll = rollByUserId(userId)
    if (matchFilters(roll.bones, filters)) {
      return { userId, roll, attempts: attempt }
    }
  }

  throw new Error(`在 ${maxAttempts} 次尝试内未命中目标条件`) 
}
