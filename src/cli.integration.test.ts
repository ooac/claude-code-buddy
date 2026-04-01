import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

function runCli(args: string[], home: string, extraEnv?: Record<string, string>): string {
  return execFileSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      ...(extraEnv ?? {}),
    },
    encoding: 'utf8',
  })
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('cli integration', () => {
  it('random -> target -> undo 流程可用', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    runCli(['random', '--no-hype'], home)
    const configAfterRandom = readFileSync(configPath, 'utf8')
    expect(configAfterRandom).toContain('"userID"')
    expect(configAfterRandom).toContain('"companion"')
    expect(configAfterRandom).toContain('"personality"')

    runCli(['target', '--rarity', 'legendary', '--max-attempts', '20000', '--no-hype'], home)
    const configAfterTarget = readFileSync(configPath, 'utf8')
    expect(configAfterTarget).not.toEqual(configAfterRandom)

    const undoOutput = runCli(['undo'], home)
    expect(undoOutput).toContain('已回滚成功')

    const configAfterUndo = readFileSync(configPath, 'utf8')
    expect(configAfterUndo).toEqual(configAfterRandom)
  })

  it('stale_possible 场景下 random/card/doctor 输出运行态告警', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const env = { BUDDY_RUNTIME_DRIFT_FORCE: 'stale_possible' }
    const randomOutput = runCli(['random', '--no-hype'], home, env)
    expect(randomOutput).toContain('运行态一致性：⚠️')
    expect(randomOutput).toContain('当前 Claude 左下角宠物可能仍是旧骨架')

    const cardOutput = runCli(['card'], home, env)
    expect(cardOutput).toContain('配置一致性：')
    expect(cardOutput).toContain('运行态一致性：⚠️')
    expect(cardOutput).toContain('当前 Claude 左下角宠物可能仍是旧骨架')

    const doctorOutput = runCli(['doctor'], home, env)
    expect(doctorOutput).toContain('运行态一致性：⚠️')
    expect(doctorOutput).toContain('运行中的 Claude 会话尚未热更新到新 userID')
  })

  it('safe 场景下不输出 stale 告警语句', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const env = { BUDDY_RUNTIME_DRIFT_FORCE: 'safe' }
    const randomOutput = runCli(['random', '--no-hype'], home, env)
    expect(randomOutput).toContain('运行态一致性：✅')
    expect(randomOutput).not.toContain('当前 Claude 左下角宠物可能仍是旧骨架')
  })
})
