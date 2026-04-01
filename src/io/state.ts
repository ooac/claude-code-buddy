import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import os from 'node:os'
import type { BuddyBones, RollFilters } from '../core/types.js'

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
  undoBackupPath: string
}

export type BuddySwitchState = {
  unluckyStreak: number
  lastSwitch?: SwitchRecord
  lastUndo?: UndoRecord
  history: SwitchRecord[]
}

const DEFAULT_STATE: BuddySwitchState = {
  unluckyStreak: 0,
  history: [],
}

export function getStatePath(homeDir = os.homedir()): string {
  return join(homeDir, '.buddy-switch', 'state.json')
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
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
      lastUndo: parsed.lastUndo,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 20) : [],
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
