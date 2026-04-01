import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import os from 'node:os'
import {
  RARITIES,
  type BuddyBones,
  type Rarity,
  type RollFilters,
  SPECIES,
  type Species,
} from '../core/types.js'

export type SwitchRecord = {
  timestamp: string
  attempts: number
  configPath: string
  backupPath: string
  previousUserId?: string
  newUserId: string
  filters: RollFilters
  result: Pick<BuddyBones, 'rarity' | 'species' | 'shiny'>
}

export type UndoRecord = {
  timestamp: string
  restoredFromBackup: string
  undoBackupPath?: string
  source: 'switch_undo' | 'pet_backup_restore'
  backupId?: string
}

export type PetBackupSummary = {
  rarity: Rarity
  species: Species
  shiny: boolean
  userId: string
  name?: string
}

export type PetBackupRecord = {
  id: string
  createdAt: string
  name?: string
  snapshotPath: string
  summary: PetBackupSummary
}

export type AppendPetBackupResult = {
  state: BuddySwitchState
  evicted: PetBackupRecord[]
}

export type BuddySwitchState = {
  unluckyStreak: number
  lastSwitch?: SwitchRecord
  lastUndo?: UndoRecord
  history: SwitchRecord[]
  petBackups: PetBackupRecord[]
}

export const PET_BACKUP_LIMIT = 5

const DEFAULT_STATE: BuddySwitchState = {
  unluckyStreak: 0,
  history: [],
  petBackups: [],
}

export function getStatePath(homeDir = os.homedir()): string {
  return join(homeDir, '.buddy-switch', 'state.json')
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
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

function parseUndoRecord(value: unknown): UndoRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const timestamp = typeof (value as { timestamp?: unknown }).timestamp === 'string'
    ? (value as { timestamp: string }).timestamp
    : undefined
  const restoredFromBackup =
    typeof (value as { restoredFromBackup?: unknown }).restoredFromBackup === 'string'
      ? (value as { restoredFromBackup: string }).restoredFromBackup
      : undefined
  if (!timestamp || !restoredFromBackup) {
    return undefined
  }

  const sourceRaw = (value as { source?: unknown }).source
  const source = sourceRaw === 'pet_backup_restore' ? 'pet_backup_restore' : 'switch_undo'
  const undoBackupPath =
    typeof (value as { undoBackupPath?: unknown }).undoBackupPath === 'string'
      ? (value as { undoBackupPath: string }).undoBackupPath
      : undefined
  const backupId =
    typeof (value as { backupId?: unknown }).backupId === 'string'
      ? (value as { backupId: string }).backupId
      : undefined

  return {
    timestamp,
    restoredFromBackup,
    undoBackupPath,
    source,
    backupId,
  }
}

function parsePetBackupRecord(value: unknown): PetBackupRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const id = typeof (value as { id?: unknown }).id === 'string'
    ? (value as { id: string }).id.trim()
    : ''
  const createdAt = typeof (value as { createdAt?: unknown }).createdAt === 'string'
    ? (value as { createdAt: string }).createdAt
    : ''
  const snapshotPath = typeof (value as { snapshotPath?: unknown }).snapshotPath === 'string'
    ? (value as { snapshotPath: string }).snapshotPath
    : ''
  const summaryRaw = (value as { summary?: unknown }).summary
  const rarity = parseRarity((summaryRaw as { rarity?: unknown } | undefined)?.rarity)
  const species = parseSpecies((summaryRaw as { species?: unknown } | undefined)?.species)
  const shiny = (summaryRaw as { shiny?: unknown } | undefined)?.shiny
  const userId = (summaryRaw as { userId?: unknown } | undefined)?.userId

  if (
    !id ||
    !createdAt ||
    !snapshotPath ||
    !rarity ||
    !species ||
    typeof shiny !== 'boolean' ||
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    return undefined
  }

  const displayName = typeof (value as { name?: unknown }).name === 'string'
    ? (value as { name: string }).name
    : undefined
  const summaryName =
    typeof (summaryRaw as { name?: unknown } | undefined)?.name === 'string'
      ? (summaryRaw as { name: string }).name
      : undefined

  return {
    id,
    createdAt,
    name: displayName,
    snapshotPath,
    summary: {
      rarity,
      species,
      shiny,
      userId,
      name: summaryName,
    },
  }
}

export function readState(statePath = getStatePath()): BuddySwitchState {
  if (!existsSync(statePath)) {
    return { ...DEFAULT_STATE }
  }

  try {
    const raw = readFileSync(statePath, 'utf8')
    const parsed = JSON.parse(raw) as BuddySwitchState
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_STATE }
    }

    return {
      unluckyStreak:
        typeof parsed.unluckyStreak === 'number' && Number.isFinite(parsed.unluckyStreak)
          ? parsed.unluckyStreak
          : 0,
      lastSwitch: parsed.lastSwitch,
      lastUndo: parseUndoRecord(parsed.lastUndo),
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : [],
      petBackups: Array.isArray((parsed as { petBackups?: unknown }).petBackups)
        ? (parsed as { petBackups: unknown[] }).petBackups
            .map(item => parsePetBackupRecord(item))
            .filter((item): item is PetBackupRecord => Boolean(item))
            .slice(0, PET_BACKUP_LIMIT)
        : [],
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function writeState(state: BuddySwitchState, statePath = getStatePath()): void {
  ensureParentDir(statePath)
  const payload = `${JSON.stringify(state, null, 2)}\n`
  writeFileSync(statePath, payload, 'utf8')
}

export function isUnluckyRoll(result: Pick<BuddyBones, 'rarity' | 'shiny'>): boolean {
  return (result.rarity === 'common' || result.rarity === 'uncommon') && !result.shiny
}

export function updateStateAfterSwitch(
  record: SwitchRecord,
  statePath = getStatePath(),
): BuddySwitchState {
  const state = readState(statePath)
  const unluckyStreak = isUnluckyRoll(record.result) ? state.unluckyStreak + 1 : 0

  const nextState: BuddySwitchState = {
    ...state,
    unluckyStreak,
    lastSwitch: record,
    history: [record, ...state.history].slice(0, 20),
  }

  writeState(nextState, statePath)
  return nextState
}

export function markUndo(
  undo: UndoRecord,
  statePath = getStatePath(),
): BuddySwitchState {
  const state = readState(statePath)
  const nextState: BuddySwitchState = {
    ...state,
    lastUndo: undo,
    lastSwitch: undefined,
  }
  writeState(nextState, statePath)
  return nextState
}

export function getPetBackupDirectory(statePath = getStatePath()): string {
  return join(dirname(statePath), 'backups')
}

export function appendPetBackup(
  backup: PetBackupRecord,
  statePath = getStatePath(),
): AppendPetBackupResult {
  const state = readState(statePath)
  const merged = [backup, ...state.petBackups]

  // 去重：同 ID 仅保留最新一条，避免重复入库。
  const deduped: PetBackupRecord[] = []
  const seen = new Set<string>()
  for (const item of merged) {
    if (seen.has(item.id)) {
      continue
    }
    deduped.push(item)
    seen.add(item.id)
  }

  const kept = deduped.slice(0, PET_BACKUP_LIMIT)
  const evicted = deduped.slice(PET_BACKUP_LIMIT)
  for (const item of evicted) {
    rmSync(item.snapshotPath, { force: true })
  }

  const nextState: BuddySwitchState = {
    ...state,
    petBackups: kept,
  }

  writeState(nextState, statePath)
  return {
    state: nextState,
    evicted,
  }
}
