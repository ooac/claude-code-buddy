import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

function runCliExpectFail(args: string[], home: string, extraEnv?: Record<string, string>): string {
  try {
    runCli(args, home, extraEnv)
    throw new Error('expected command to fail')
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr
    if (typeof stderr === 'string') {
      return stderr
    }
    return String(error)
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('cli integration', () => {
  it('backup save -> list -> restore 全链路可用（含自定义路径）', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const customBase = join(home, '配置 空格', '备份目录')
    mkdirSync(customBase, { recursive: true })
    const customConfigPath = join(customBase, 'buddy 配置.json')
    const customStatePath = join(customBase, 'state dir', 'state.json')
    writeFileSync(customConfigPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    runCli(['--config-path', customConfigPath, '--state-path', customStatePath, 'random', '--no-hype'], home)
    const savedConfigRaw = readFileSync(customConfigPath, 'utf8')

    const saveOutput = runCli(
      ['--config-path', customConfigPath, '--state-path', customStatePath, 'backup', 'save', '--name', '收藏1'],
      home,
    )
    expect(saveOutput).toContain('宠物备份成功')
    const idMatch = saveOutput.match(/备份 ID:\s*(\S+)/)
    expect(idMatch?.[1]).toBeTruthy()
    const backupId = idMatch?.[1] ?? ''

    const listOutput = runCli(
      ['--config-path', customConfigPath, '--state-path', customStatePath, 'backup', 'list'],
      home,
    )
    expect(listOutput).toContain('- [1] ID:')
    expect(listOutput).toContain(`ID: ${backupId}`)
    expect(listOutput).toContain('物种')
    expect(listOutput).toContain('稀有度')

    runCli(['--config-path', customConfigPath, '--state-path', customStatePath, 'random', '--no-hype'], home)
    const changedConfigRaw = readFileSync(customConfigPath, 'utf8')
    expect(changedConfigRaw).not.toEqual(savedConfigRaw)

    const restoreOutput = runCli(
      ['--config-path', customConfigPath, '--state-path', customStatePath, 'backup', 'restore', '--index', '1'],
      home,
    )
    expect(restoreOutput).toContain('已恢复到备份宠物')
    expect(restoreOutput).toContain('恢复序号')
    expect(restoreOutput).toContain('非交互环境')
    const restoredConfigRaw = readFileSync(customConfigPath, 'utf8')
    expect(restoredConfigRaw).toEqual(savedConfigRaw)
  })

  it('backup 备份池严格最多 5 条并淘汰最旧快照', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    for (let i = 0; i < 6; i++) {
      runCli(['random', '--no-hype'], home)
      runCli(['backup', 'save', '--name', `slot-${i}`], home)
    }

    const listOutput = runCli(['backup', 'list'], home)
    const idLines = listOutput.match(/- \[\d\] ID:/g) ?? []
    expect(idLines).toHaveLength(5)

    const backupDir = join(home, '.buddy-switch', 'backups')
    const snapshotFiles = readdirSync(backupDir).filter(name => name.endsWith('.json'))
    expect(snapshotFiles).toHaveLength(5)
  })

  it('backup restore 在 ID 不存在时给出明确错误', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const stderr = runCliExpectFail(['backup', 'restore', '--id', 'not-exist-id'], home)
    expect(stderr).toContain('找不到备份 ID')
  })

  it('backup restore 在序号无效时给出明确错误', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const stderr = runCliExpectFail(['backup', 'restore', '--index', '9'], home)
    expect(stderr).toContain('恢复序号必须是 1~5 的整数')
  })

  it('backup restore 在快照文件缺失时给出明确错误', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    runCli(['random', '--no-hype'], home)
    const saveOutput = runCli(['backup', 'save', '--name', 'slot-x'], home)
    const idMatch = saveOutput.match(/备份 ID:\s*(\S+)/)
    const backupId = idMatch?.[1] ?? ''
    expect(backupId).not.toBe('')

    const statePath = join(home, '.buddy-switch', 'state.json')
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
      petBackups?: Array<{ id?: string; snapshotPath?: string }>
    }
    const snapshotPath = state.petBackups?.find(item => item.id === backupId)?.snapshotPath
    expect(typeof snapshotPath).toBe('string')
    rmSync(snapshotPath ?? '', { force: true })

    const stderr = runCliExpectFail(['backup', 'restore', '--id', backupId], home)
    expect(stderr).toContain('备份快照不存在')
  })

  it('支持 --config-path / --state-path 显式覆盖，并兼容空格与中文路径', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const customBase = join(home, '配置 空格', '二级目录')
    mkdirSync(customBase, { recursive: true })
    const customConfigPath = join(customBase, 'buddy 配置.json')
    const customStatePath = join(customBase, '状态目录', 'state.json')
    writeFileSync(customConfigPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const output = runCli(
      [
        '--config-path',
        customConfigPath,
        '--state-path',
        customStatePath,
        'random',
        '--no-hype',
      ],
      home,
    )
    expect(output).toContain('切换完成')
    expect(existsSync(customStatePath)).toBe(true)
    expect(existsSync(join(home, '.claude.json'))).toBe(false)

    const customConfigAfter = readFileSync(customConfigPath, 'utf8')
    expect(customConfigAfter).toContain('"userID"')
  })

  it('ASCII 模式下输出自动降级为英文无 Emoji', () => {
    const home = mkdtempSync(join(os.tmpdir(), 'buddy-switch-cli-'))
    tempDirs.push(home)

    const configPath = join(home, '.claude.json')
    writeFileSync(configPath, JSON.stringify({ hasCompletedOnboarding: true }, null, 2))

    const output = runCli(['random', '--no-hype'], home, { BUDDY_FORCE_ASCII: '1' })
    expect(output).toContain('[OK] Switch completed')
    expect(output).not.toContain('切换完成')
    expect(output).not.toContain('✅')
  })

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
