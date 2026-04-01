#!/usr/bin/env node
import { isAbsolute, resolve } from 'node:path'
import { Command } from 'commander'
import chalk from 'chalk'
import {
  createRandomUserId,
  findUserIdByFilters,
  rollByUserId,
} from './core/buddy-engine.js'
import { buildSyncedCompanion, extractCompanionSignature } from './core/companion-sync.js'
import {
  combinedProbability,
  expectedAttempts,
  formatPercent,
  rareOrBetterProbability,
  rarityProbability,
} from './core/probability.js'
import { getHashMode } from './core/seed.js'
import { RARITIES, RARITY_ZH, SPECIES, SPECIES_ZH, type RollFilters, type Rarity, type Species } from './core/types.js'
import {
  backupCurrentConfigForUndo,
  hasAccountUuid,
  readClaudeConfig,
  resolveEffectiveUserId,
  restoreConfigFromBackup,
  switchUserIdWithBackup,
} from './io/claude-config.js'
import { resolvePathOptions, type ResolvedPathOptions } from './io/path-options.js'
import { detectRuntimeDrift, formatRuntimeDriftStatus } from './io/runtime-drift.js'
import { markUndo, readState, updateStateAfterSwitch } from './io/state.js'
import { playHatchHype } from './ui/hype.js'
import { pickIcon, pickText } from './ui/output-mode.js'
import { formatFilters, renderBuddyCard, renderDoctorMessage } from './ui/render.js'

type SwitchCommandOptions = {
  species?: string
  rarity?: string
  shiny?: boolean
  maxAttempts: number
  hype: boolean
}

type GlobalCliOptions = {
  configPath?: string
  statePath?: string
}

function msg(zh: string, en: string): string {
  return pickText(zh, en)
}

function parseAbsolutePath(input: string | undefined, optionName: string): string | undefined {
  if (typeof input !== 'string') {
    return undefined
  }
  const trimmed = input.trim()
  if (!trimmed) {
    return undefined
  }
  if (!isAbsolute(trimmed)) {
    throw new Error(msg(`${optionName} 需要绝对路径：${trimmed}`, `${optionName} requires absolute path: ${trimmed}`))
  }
  return resolve(trimmed)
}

function getResolvedPaths(globalOptions: GlobalCliOptions): ResolvedPathOptions {
  const configPath = parseAbsolutePath(globalOptions.configPath, '--config-path')
  const statePath = parseAbsolutePath(globalOptions.statePath, '--state-path')
  return resolvePathOptions({ configPath, statePath })
}

function parseRarity(input?: string): Rarity | undefined {
  if (!input) {
    return undefined
  }
  if (!RARITIES.includes(input as Rarity)) {
    throw new Error(msg(`无效 rarity：${input}。可选值：${RARITIES.join(', ')}`, `invalid rarity: ${input}. valid: ${RARITIES.join(', ')}`))
  }
  return input as Rarity
}

function parseSpecies(input?: string): Species | undefined {
  if (!input) {
    return undefined
  }
  if (!SPECIES.includes(input as Species)) {
    throw new Error(msg(`无效 species：${input}。可选值：${SPECIES.join(', ')}`, `invalid species: ${input}. valid: ${SPECIES.join(', ')}`))
  }
  return input as Species
}

function parsePositiveInt(input: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(msg('max-attempts 必须是正整数', 'max-attempts must be a positive integer'))
  }
  return value
}

function filtersFromOptions(options: SwitchCommandOptions): RollFilters {
  return {
    species: parseSpecies(options.species),
    rarity: parseRarity(options.rarity),
    shiny: options.shiny ? true : undefined,
  }
}

function hasAnyFilter(filters: RollFilters): boolean {
  return Boolean(filters.rarity || filters.species || typeof filters.shiny === 'boolean')
}

function hashModeLabel(): string {
  return getHashMode() === 'bun_exact' ? 'bun-exact(bun-hash)' : 'fnv-1a'
}

function readCompanionHatchedAt(companion: unknown): number | undefined {
  if (!companion || typeof companion !== 'object' || Array.isArray(companion)) {
    return undefined
  }
  const raw = (companion as { hatchedAt?: unknown }).hatchedAt
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
}

async function executeSwitch(
  mode: 'random' | 'target',
  filters: RollFilters,
  maxAttempts: number,
  hype: boolean,
  paths: ResolvedPathOptions,
): Promise<void> {
  let result: { userId: string; attempts: number; roll: ReturnType<typeof rollByUserId> }

  if (!hasAnyFilter(filters)) {
    const userId = createRandomUserId()
    result = {
      userId,
      attempts: 1,
      roll: rollByUserId(userId),
    }
  } else {
    result = findUserIdByFilters(filters, maxAttempts)
  }

  const configBeforeSwitch = readClaudeConfig(paths.configPath)
  const syncedCompanion = buildSyncedCompanion(
    result.userId,
    result.roll.bones,
    configBeforeSwitch.companion,
  )

  const mutation = switchUserIdWithBackup(result.userId, paths.configPath, {
    companion: syncedCompanion,
  })
  const record = {
    timestamp: new Date().toISOString(),
    attempts: result.attempts,
    configPath: mutation.configPath,
    backupPath: mutation.backupPath,
    previousUserId: mutation.previousUserId,
    newUserId: mutation.newUserId,
    filters,
    result: {
      rarity: result.roll.bones.rarity,
      species: result.roll.bones.species,
      shiny: result.roll.bones.shiny,
    },
  }

  const state = updateStateAfterSwitch(record, paths.statePath)
  await playHatchHype({
    bones: result.roll.bones,
    attempts: result.attempts,
    unluckyStreak: state.unluckyStreak,
    enabled: hype,
  })

  process.stdout.write(`${chalk.green(msg(`${pickIcon('✅ ', '')}切换完成`, '[OK] Switch completed'))} (${mode})\n`)
  process.stdout.write(`${chalk.gray(`${msg('命中条件', 'Filters')}: ${formatFilters(filters)}`)}\n`)
  process.stdout.write(`${chalk.gray(`${msg('新 userID', 'New userID')}: ${result.userId}`)}\n`)
  process.stdout.write(`${chalk.gray(`${msg('哈希模式', 'Hash mode')}: ${hashModeLabel()}`)}\n`)
  process.stdout.write(`${chalk.gray(`${msg('配置备份', 'Config backup')}: ${mutation.backupPath}`)}\n`)
  process.stdout.write(
    `${chalk.gray(msg('companion 已同步：仅写入名字/个性（soul），骨架按种子实时推演', 'companion synced: soul only (name/personality), bones derived from seed.'))}\n`,
  )
  process.stdout.write(`${renderBuddyCard(result.roll.bones)}\n`)

  if (hasAccountUuid(mutation.config)) {
    process.stdout.write(
      `${chalk.yellow(msg(`${pickIcon('⚠️ ', '[WARN] ')}检测到 accountUuid，/buddy 可能优先读取 accountUuid，切换可能不生效。`, '[WARN] accountUuid detected. /buddy may prefer accountUuid; switch may not take effect.'))}\n`,
    )
  }
}

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('buddy-switch')
    .description(msg('Buddy 一键切换 CLI 插件（稀有度概率 + 热血孵化反馈）', 'Buddy one-command switch CLI (probability + hatch feedback)'))
    .version('0.1.0')
    .option('--config-path <absPath>', msg('显式指定配置文件绝对路径', 'explicit absolute config path'))
    .option('--state-path <absPath>', msg('显式指定状态文件绝对路径', 'explicit absolute state path'))

  program
    .command('random')
    .description(msg('一键随机新宠，可附筛选条件', 'random switch, optional filters'))
    .option('--species <species>', msg('指定物种筛选', 'species filter'))
    .option('--rarity <rarity>', msg('指定稀有度筛选', 'rarity filter'))
    .option('--shiny-only', msg('仅闪光', 'shiny only'))
    .option('--max-attempts <n>', msg('最大尝试次数', 'max attempts'), parsePositiveInt, 200000)
    .option('--no-hype', msg('关闭孵化情绪动画', 'disable hype animation'))
    .action(async function (options: SwitchCommandOptions) {
      const paths = getResolvedPaths(this.optsWithGlobals() as GlobalCliOptions)
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: (options as SwitchCommandOptions & { shinyOnly?: boolean }).shiny ?? (options as unknown as { shinyOnly?: boolean }).shinyOnly,
        maxAttempts: options.maxAttempts,
        hype: options.hype,
      })
      await executeSwitch('random', filters, options.maxAttempts, options.hype, paths)
    })

  program
    .command('target')
    .description(msg('按目标条件刷宠物', 'switch by target filters'))
    .option('--species <species>', msg('目标物种', 'target species'))
    .option('--rarity <rarity>', msg('目标稀有度', 'target rarity'))
    .option('--shiny', msg('目标为闪光', 'target shiny'))
    .option('--max-attempts <n>', msg('最大尝试次数', 'max attempts'), parsePositiveInt, 1000000)
    .option('--no-hype', msg('关闭孵化情绪动画', 'disable hype animation'))
    .action(async function (options: SwitchCommandOptions) {
      const paths = getResolvedPaths(this.optsWithGlobals() as GlobalCliOptions)
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: options.shiny,
        maxAttempts: options.maxAttempts,
        hype: options.hype,
      })

      if (!hasAnyFilter(filters)) {
        throw new Error(msg('target 模式至少要指定一个条件：--species / --rarity / --shiny', 'target requires at least one filter: --species / --rarity / --shiny'))
      }

      await executeSwitch('target', filters, options.maxAttempts, options.hype, paths)
    })

  program
    .command('prob')
    .description(msg('查看稀有度与目标命中概率', 'show rarity and target hit probability'))
    .option('--species <species>', msg('目标物种', 'target species'))
    .option('--rarity <rarity>', msg('目标稀有度', 'target rarity'))
    .option('--shiny', msg('目标闪光', 'target shiny'))
    .action(options => {
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: options.shiny,
        maxAttempts: 1,
        hype: false,
      })

      const hasTarget = hasAnyFilter(filters)

      process.stdout.write(chalk.bold(`${msg('=== 概率面板 ===', '=== Probability Panel ===')}\n`))
      process.stdout.write(`${msg('闪光概率', 'Shiny chance')}: ${formatPercent(0.01)}\n`)
      process.stdout.write(`${msg('稀有及以上概率', 'Rare+ chance')}: ${formatPercent(rareOrBetterProbability())}\n`)
      process.stdout.write(`${msg('物种单项概率', 'Single species chance')}: ${formatPercent(1 / SPECIES.length)} (1/${SPECIES.length})\n\n`)

      process.stdout.write(chalk.bold(`${msg('稀有度分布', 'Rarity distribution')}:\n`))
      for (const rarity of RARITIES) {
        const probability = rarityProbability(rarity)
        const rarityLabel = pickText(`${RARITY_ZH[rarity]}(${rarity})`, rarity)
        process.stdout.write(
          `- ${rarityLabel}: ${formatPercent(probability)}, ${msg('期望', 'expected')} ${expectedAttempts(probability).toFixed(2)} ${msg('抽', 'pulls')}\n`,
        )
      }

      if (hasTarget) {
        const probability = combinedProbability(filters)
        const expected = expectedAttempts(probability)
        process.stdout.write(`\n${chalk.bold(`${msg('目标条件', 'Target filters')}:`)} ${formatFilters(filters)}\n`)
        process.stdout.write(`${chalk.bold(`${msg('命中概率', 'Hit chance')}:`)} ${formatPercent(probability)}\n`)
        process.stdout.write(`${chalk.bold(`${msg('期望抽数', 'Expected pulls')}:`)} ${expected.toFixed(2)}\n`)
      }
    })

  program
    .command('card')
    .description(msg('展示当前宠物卡片', 'show current buddy card'))
    .action(function () {
      const paths = getResolvedPaths(this.optsWithGlobals() as GlobalCliOptions)
      const config = readClaudeConfig(paths.configPath)
      const { userId, source } = resolveEffectiveUserId(config)
      const roll = rollByUserId(userId)
      const signature = extractCompanionSignature(config.companion)
      const possibleSoulMismatch =
        Boolean(signature.rarity && signature.rarity !== roll.bones.rarity) ||
        Boolean(signature.species && signature.species !== roll.bones.species)

      process.stdout.write(chalk.bold(`${msg('=== 当前宠物 ===', '=== Current Buddy ===')}\n`))
      process.stdout.write(`${msg('种子来源', 'Seed source')}: ${source}\n`)
      process.stdout.write(`${msg('哈希模式', 'Hash mode')}: ${hashModeLabel()}\n`)
      process.stdout.write(
        `${msg('种子值', 'Seed value')}: ${source === 'accountUuid' ? chalk.yellow(userId) : chalk.green(userId)}\n\n`,
      )
      process.stdout.write(chalk.bold(`${msg('=== companion（当前配置，soul）===', '=== companion (config, soul) ===')}\n`))
      process.stdout.write(`${msg('名称', 'Name')}: ${signature.name ?? msg('未设置', 'unset')}\n`)
      process.stdout.write(`${msg('解析来源', 'Parsed from')}: ${signature.source}\n`)
      if (signature.personality) {
        process.stdout.write(`${msg('个性', 'Personality')}: ${signature.personality}\n`)
      }
      if (signature.rarity && signature.species) {
        process.stdout.write(
          `${msg('个性推断', 'Soul hint')}: ${pickText(RARITY_ZH[signature.rarity], signature.rarity)} / ${pickText(SPECIES_ZH[signature.species], signature.species)} ${msg('（仅供参考）', '(for reference)')}\n`,
        )
      }
      process.stdout.write('\n')
      process.stdout.write(chalk.bold(`${msg('=== 种子推演骨架 ===', '=== Seed-derived Bones ===')}\n`))
      process.stdout.write(`${renderBuddyCard(roll.bones)}\n`)

      if (!signature.name || !signature.personality) {
        process.stdout.write(msg('配置状态：⚠️ 当前 companion soul 不完整，可执行 random/target 重新同步。\n', 'Config status: [WARN] companion soul incomplete; run random/target to sync.\n'))
      } else if (possibleSoulMismatch) {
        process.stdout.write(
          msg('配置状态：⚠️ companion soul 与当前种子推演可能不一致（常见于旧算法遗留），建议执行 random/target 同步。\n', 'Config status: [WARN] companion soul may mismatch current seed-derived bones (often legacy hash output); run random/target to sync.\n'),
        )
      } else {
        process.stdout.write(msg('配置状态：✅ companion soul 已就绪（骨架以种子推演结果为准）。\n', 'Config status: [OK] companion soul ready (bones derived from seed).\n'))
      }
    })

  program
    .command('undo')
    .description(msg('回滚到上一次切换前的配置', 'rollback to previous config'))
    .action(function () {
      const paths = getResolvedPaths(this.optsWithGlobals() as GlobalCliOptions)
      const state = readState(paths.statePath)
      if (!state.lastSwitch) {
        throw new Error(msg('没有可回滚记录，请先执行 random 或 target', 'no rollback record, run random or target first'))
      }

      const undoBackupPath = backupCurrentConfigForUndo(state.lastSwitch.configPath)
      restoreConfigFromBackup(state.lastSwitch.configPath, state.lastSwitch.backupPath)

      markUndo(
        {
          timestamp: new Date().toISOString(),
          restoredFromBackup: state.lastSwitch.backupPath,
          undoBackupPath,
        },
        paths.statePath,
      )

      process.stdout.write(`${chalk.green(msg(`${pickIcon('✅ ', '')}已回滚成功`, '[OK] rollback completed'))}\n`)
      process.stdout.write(`${msg('恢复来源', 'Restored from')}: ${state.lastSwitch.backupPath}\n`)
      process.stdout.write(`${msg('当前前置备份', 'Current pre-undo backup')}: ${undoBackupPath}\n`)
    })

  program
    .command('doctor')
    .description(msg('检查 accountUuid 锁定与配置状态', 'check accountUuid lock and runtime status'))
    .action(function () {
      const paths = getResolvedPaths(this.optsWithGlobals() as GlobalCliOptions)
      const config = readClaudeConfig(paths.configPath)
      const lock = hasAccountUuid(config)
      const { source } = resolveEffectiveUserId(config)
      const state = readState(paths.statePath)
      const runtimeDrift = detectRuntimeDrift({
        switchTimestamp: state.lastSwitch?.timestamp,
        companionHatchedAt: readCompanionHatchedAt(config.companion),
      })

      process.stdout.write(chalk.bold(`${msg('=== Buddy Doctor ===', '=== Buddy Doctor ===')}\n`))
      process.stdout.write(`${msg('配置路径', 'Config path')}: ${paths.configPath}\n`)
      process.stdout.write(`${msg('状态路径', 'State path')}: ${paths.statePath}\n`)
      process.stdout.write(`${msg('当前种子来源', 'Current seed source')}: ${source}\n`)
      process.stdout.write(`${msg('当前哈希模式', 'Current hash mode')}: ${hashModeLabel()}\n`)
      process.stdout.write(`${renderDoctorMessage(lock)}\n`)
      process.stdout.write(chalk.bold(`${msg('=== 运行态诊断（可选）===', '=== Runtime Check (Optional) ===')}\n`))
      process.stdout.write(`${formatRuntimeDriftStatus(runtimeDrift)}\n`)
      process.stdout.write(msg('说明：该诊断仅用于排查会话状态，不代表映射算法是否正确。\n', 'Info: runtime check is for session diagnosis only, not hash correctness proof.\n'))
      if (runtimeDrift.status === 'stale_possible') {
        process.stdout.write(msg('建议：重开 Claude 会话后再观察左下角宠物展示。\n', 'Suggestion: reopen Claude session and re-check the buddy in lower-left corner.\n'))
      }
    })

  await program.parseAsync(process.argv)
}

main().catch(error => {
  process.stderr.write(`${chalk.red(`${msg(`${pickIcon('❌ ', '[ERROR] ')}执行失败：`, '[ERROR] failed: ')}`)}${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
