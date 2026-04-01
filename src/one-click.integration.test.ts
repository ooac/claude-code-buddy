import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('one-click script', () => {
  it('card 命令不再追加热更新固定告警提示', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-script-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const output = execFileSync('bash', ['./one-click.sh', 'card'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: home,
        BUDDY_RUNTIME_DRIFT_FORCE: 'stale_possible',
      },
      encoding: 'utf8',
    })

    expect(output).toContain('=== 当前宠物 ===')
    expect(output).not.toContain('运行态一致性：')
    expect(output).not.toContain('检测到运行中 Claude 可能未热更新 userID，建议重开会话。')
  })

  it('支持透传 backup list 命令', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-script-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const output = execFileSync('bash', ['./one-click.sh', 'backup', 'list'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: home,
      },
      encoding: 'utf8',
    })

    expect(output).toContain('宠物备份列表')
    expect(output).toContain('当前没有宠物备份')
  })
})
