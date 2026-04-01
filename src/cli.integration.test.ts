import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []
let built = false

function ensureBuilt(): void {
  if (built && existsSync('dist/cli.js')) {
    return
  }
  execFileSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'ignore',
  })
  built = true
}

function runCli(args: string[], home: string, extraEnv?: Record<string, string>): string {
  ensureBuilt()
  return execFileSync(process.execPath, ['dist/cli.js', ...args], {
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
    const parsedAfterRandom = JSON.parse(configAfterRandom) as { companion?: Record<string, unknown> }
    expect(Object.keys(parsedAfterRandom.companion ?? {}).sort()).toEqual(['hatchedAt', 'name', 'personality'])

    runCli(['target', '--rarity', 'legendary', '--max-attempts', '20000', '--no-hype'], home)
    const configAfterTarget = readFileSync(configPath, 'utf8')
    expect(configAfterTarget).not.toEqual(configAfterRandom)

    const undoOutput = runCli(['undo'], home)
    expect(undoOutput).toContain('已回滚成功')

    const configAfterUndo = readFileSync(configPath, 'utf8')
    expect(configAfterUndo).toEqual(configAfterRandom)
  })

  it('stale_possible 场景下仅 doctor 输出运行态告警', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const env = { BUDDY_RUNTIME_DRIFT_FORCE: 'stale_possible' }
    const randomOutput = runCli(['random', '--no-hype'], home, env)
    expect(randomOutput).not.toContain('运行态一致性：')
    expect(randomOutput).toContain('companion 已同步：仅写入名字/个性（soul）')

    const cardOutput = runCli(['card'], home, env)
    expect(cardOutput).toContain('配置状态：')
    expect(cardOutput).not.toContain('运行态一致性：')

    const doctorOutput = runCli(['doctor'], home, env)
    expect(doctorOutput).toContain('运行态一致性：⚠️')
    expect(doctorOutput).toContain('运行态诊断（可选）')
    expect(doctorOutput).toContain('仅用于排查会话状态')
  })

  it('safe 场景下 doctor 不输出 stale 告警语句', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const env = { BUDDY_RUNTIME_DRIFT_FORCE: 'safe' }
    runCli(['random', '--no-hype'], home, env)
    const doctorOutput = runCli(['doctor'], home, env)
    expect(doctorOutput).toContain('运行态一致性：✅')
    expect(doctorOutput).not.toContain('重开 Claude 会话后再观察左下角宠物展示')
  })
})
