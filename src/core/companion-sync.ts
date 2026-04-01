import { hashString, mulberry32 } from './seed.js'
import { RARITIES, type Rarity, SPECIES, type Species, type BuddyBones } from './types.js'

export type CompanionSignature = {
  rarity?: Rarity
  species?: Species
  name?: string
  personality?: string
  source: 'fields' | 'personality' | 'unknown'
}

const NAME_PREFIX = ['Nova', 'Mochi', 'Pixel', 'Pudding', 'Nori', 'Biscuit', 'Clover', 'Tofu'] as const
const NAME_SUFFIX = ['Spark', 'Puff', 'Bean', 'Dash', 'Rune', 'Pop', 'Wave', 'Chip'] as const
const SPECIES_NAME_STEM: Record<Species, string> = {
  duck: 'Ducky',
  goose: 'Goosy',
  blob: 'Bloby',
  cat: 'Kitty',
  dragon: 'Drako',
  octopus: 'Octy',
  owl: 'Owly',
  penguin: 'Pingu',
  turtle: 'Turtly',
  snail: 'Snaily',
  ghost: 'Ghosty',
  axolotl: 'Axo',
  capybara: 'Capy',
  cactus: 'Cacti',
  robot: 'Robo',
  rabbit: 'Bunny',
  mushroom: 'Shroomy',
  chonk: 'Chonky',
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pick<T>(rng: () => number, pool: readonly T[]): T {
  return pool[Math.floor(rng() * pool.length)] as T
}

function createCompanionName(userId: string, species: Species): string {
  const rng = mulberry32(hashString(`${userId}:buddy-soul-name:${species}`))
  const style = Math.floor(rng() * 3)
  const stem = SPECIES_NAME_STEM[species]
  if (style === 0) {
    return `${stem}${pick(rng, NAME_SUFFIX)}`
  }
  if (style === 1) {
    return `${pick(rng, NAME_PREFIX)}${stem}`
  }
  return `${stem}${Math.floor(rng() * 90) + 10}`
}

function createCompanionPersonality(bones: BuddyBones): string {
  const vibeByRarity: Record<Rarity, string> = {
    common: 'of few words',
    uncommon: 'who keeps your momentum warm',
    rare: 'that quietly raises your ceiling',
    epic: 'that turns pressure into fuel',
    legendary: 'that makes every run feel like destiny',
  }

  const shinyTail = bones.shiny ? ' It sparkles when luck spikes.' : ''
  return `A ${bones.rarity} ${bones.species} ${vibeByRarity[bones.rarity]}.${shinyTail}`
}

function parseRarity(value: unknown): Rarity | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return (RARITIES as readonly string[]).includes(value) ? (value as Rarity) : undefined
}

function parseSpecies(value: unknown): Species | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return (SPECIES as readonly string[]).includes(value) ? (value as Species) : undefined
}

export function extractCompanionSignature(companion: unknown): CompanionSignature {
  if (!isObjectRecord(companion)) {
    return { source: 'unknown' }
  }

  const name = typeof companion.name === 'string' ? companion.name : undefined
  const personality = typeof companion.personality === 'string' ? companion.personality : undefined

  const rarityFromFields = parseRarity(companion.rarity)
  const speciesFromFields = parseSpecies(companion.species)
  if (rarityFromFields || speciesFromFields) {
    return {
      rarity: rarityFromFields,
      species: speciesFromFields,
      name,
      personality,
      source: 'fields',
    }
  }

  if (personality) {
    const rarityMatch = personality.match(/\b(common|uncommon|rare|epic|legendary)\b/i)
    const speciesMatch = personality.match(
      /\b(duck|goose|blob|cat|dragon|octopus|owl|penguin|turtle|snail|ghost|axolotl|capybara|cactus|robot|rabbit|mushroom|chonk)\b/i,
    )

    return {
      rarity: parseRarity(rarityMatch?.[1]?.toLowerCase()),
      species: parseSpecies(speciesMatch?.[1]?.toLowerCase()),
      name,
      personality,
      source: 'personality',
    }
  }

  return { name, source: 'unknown' }
}

export function buildSyncedCompanion(
  userId: string,
  bones: BuddyBones,
  _currentCompanion?: unknown,
): Record<string, unknown> {
  // 名称每次跟随物种刷新，避免“名字与当前宠物不匹配”的感知。
  const name = createCompanionName(userId, bones.species)

  return {
    // 仅持久化 soul，骨架统一由种子实时推演。
    name,
    personality: createCompanionPersonality(bones),
    hatchedAt: Date.now(),
  }
}
