import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readClaudeConfig,
  restoreConfigFromBackup,
  switchUserIdWithBackup,
} from './claude-config.js'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('claude-config', () => {
  it('切换 userID 会生成备份，并支持回滚', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-test-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ userID: 'old-user', theme: 'dark' }, null, 2))

    const mutation = switchUserIdWithBackup('new-user', configPath)
    const nextConfig = readClaudeConfig(configPath)

    expect(mutation.previousUserId).toBe('old-user')
    expect(nextConfig.userID).toBe('new-user')

    const backupRaw = readFileSync(mutation.backupPath, 'utf8')
    expect(backupRaw).toContain('old-user')

    restoreConfigFromBackup(configPath, mutation.backupPath)
    const restored = readClaudeConfig(configPath)
    expect(restored.userID).toBe('old-user')
  })

  it('切换时可同步写入 companion', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-test-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          userID: 'old-user',
          companion: { name: 'Crumpet', personality: 'A common blob of few words.', hatchedAt: 1 },
        },
        null,
        2,
      ),
    )

    switchUserIdWithBackup('new-user', configPath, {
      companion: {
        name: 'Crumpet',
        personality: 'A rare cat that raises the ceiling.',
        hatchedAt: 2,
        rarity: 'rare',
        species: 'cat',
      },
    })

    const nextConfig = readClaudeConfig(configPath)
    expect(nextConfig.userID).toBe('new-user')
    expect(nextConfig.companion).toEqual({
      name: 'Crumpet',
      personality: 'A rare cat that raises the ceiling.',
      hatchedAt: 2,
      rarity: 'rare',
      species: 'cat',
    })
  })
})
