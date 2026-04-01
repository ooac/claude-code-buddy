import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appendPetBackup,
  getPetBackupDirectory,
  markUndo,
  readState,
  type PetBackupRecord,
  PET_BACKUP_LIMIT,
} from './state.js'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createBackup(index: number, snapshotPath: string): PetBackupRecord {
  return {
    id: `pet-${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    snapshotPath,
    summary: {
      rarity: 'rare',
      species: 'cat',
      shiny: false,
      userId: `user-${index}`,
      name: `name-${index}`,
    },
  }
}

describe('state pet backup pool', () => {
  it('第 6 条备份会淘汰最旧一条并清理快照文件', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-state-'))
    tempDirs.push(home)

    const statePath = join(home, '.buddy-switch', 'state.json')
    const backupDir = getPetBackupDirectory(statePath)
    mkdirSync(backupDir, { recursive: true })

    for (let i = 1; i <= 6; i++) {
      const snapshotPath = join(backupDir, `snapshot-${i}.json`)
      writeFileSync(snapshotPath, JSON.stringify({ userID: `user-${i}` }, null, 2))
      appendPetBackup(createBackup(i, snapshotPath), statePath)
    }

    const state = readState(statePath)
    expect(state.petBackups).toHaveLength(PET_BACKUP_LIMIT)
    expect(state.petBackups.map(item => item.id)).toEqual(['pet-6', 'pet-5', 'pet-4', 'pet-3', 'pet-2'])
    expect(existsSync(join(backupDir, 'snapshot-1.json'))).toBe(false)
  })

  it('markUndo 可记录来源与备份 ID', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-state-'))
    tempDirs.push(home)

    const statePath = join(home, '.buddy-switch', 'state.json')
    markUndo(
      {
        timestamp: new Date().toISOString(),
        restoredFromBackup: '/tmp/backup.json',
        undoBackupPath: '/tmp/pre-restore.json',
        source: 'pet_backup_restore',
        backupId: 'pet-abc',
      },
      statePath,
    )

    const state = readState(statePath)
    expect(state.lastUndo?.source).toBe('pet_backup_restore')
    expect(state.lastUndo?.backupId).toBe('pet-abc')

    const raw = JSON.parse(readFileSync(statePath, 'utf8')) as { lastUndo?: { source?: string } }
    expect(raw.lastUndo?.source).toBe('pet_backup_restore')
  })
})
