#!/usr/bin/env node
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
  getClaudeConfigPath,
  hasAccountUuid,
  readClaudeConfig,
  resolveEffectiveUserId,
  restoreConfigFromBackup,
  switchUserIdWithBackup,
} from './io/claude-config.js'
import { detectRuntimeDrift, formatRuntimeDriftStatus } from './io/runtime-drift.js'
import { markUndo, readState, updateStateAfterSwitch } from './io/state.js'
import { playHatchHype } from './ui/hype.js'
import { formatFilters, renderBuddyCard, renderDoctorMessage } from './ui/render.js'

type SwitchCommandOptions = {
  species?: string
  rarity?: string
  shiny?: boolean
  maxAttempts: number
  hype: boolean
}

function parseRarity(input?: string): Rarity | undefined {
  if (!input) {
    return undefined
  }
  if (!RARITIES.includes(input as Rarity)) {
    throw new Error(`无效 rarity：${input}。可选值：${RARITIES.join(', ')}`)
  }
  return input as Rarity
}

function parseSpecies(input?: string): Species | undefined {
  if (!input) {
    return undefined
  }
  if (!SPECIES.includes(input as Species)) {
    throw new Error(`无效 species：${input}。可选值：${SPECIES.join(', ')}`)
  }
  return input as Species
}

function parsePositiveInt(input: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('max-attempts 必须是正整数')
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
  return getHashMode() === 'bun' ? 'bun-compat(wyhash)' : 'fnv-1a'
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

  const configBeforeSwitch = readClaudeConfig()
  const syncedCompanion = buildSyncedCompanion(
    result.userId,
    result.roll.bones,
    configBeforeSwitch.companion,
  )

  const mutation = switchUserIdWithBackup(result.userId, undefined, {
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

  const state = updateStateAfterSwitch(record)
  await playHatchHype({
    bones: result.roll.bones,
    attempts: result.attempts,
    unluckyStreak: state.unluckyStreak,
    enabled: hype,
  })

  process.stdout.write(`${chalk.green('✅ 切换完成')}（模式：${mode}）\n`)
  process.stdout.write(`${chalk.gray(`命中条件：${formatFilters(filters)}`)}\n`)
  process.stdout.write(`${chalk.gray(`新 userID：${result.userId}`)}\n`)
  process.stdout.write(`${chalk.gray(`哈希模式：${hashModeLabel()}`)}\n`)
  process.stdout.write(`${chalk.gray(`配置备份：${mutation.backupPath}`)}\n`)
  process.stdout.write(`${chalk.gray('companion 已同步：名字/个性/骨架已与新种子对齐')}\n`)
  process.stdout.write(`${renderBuddyCard(result.roll.bones)}\n`)

  const runtimeDrift = detectRuntimeDrift({
    switchTimestamp: record.timestamp,
    companionHatchedAt: readCompanionHatchedAt(syncedCompanion),
  })
  process.stdout.write(`${formatRuntimeDriftStatus(runtimeDrift)}\n`)
  if (runtimeDrift.status === 'stale_possible') {
    process.stdout.write(
      `${chalk.yellow('⚠️ 当前 Claude 左下角宠物可能仍是旧骨架，需重开会话后才会和本次切换一致。')}\n`,
    )
  }

  if (hasAccountUuid(mutation.config)) {
    process.stdout.write(
      `${chalk.yellow('⚠️ 提示：检测到 accountUuid，/buddy 可能优先读取 accountUuid，切换可能不生效。')}\n`,
    )
  }
}

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('buddy-switch')
    .description('Buddy 一键切换 CLI 插件（稀有度概率 + 热血孵化反馈）')
    .version('0.1.0')

  program
    .command('random')
    .description('一键随机新宠，可附筛选条件')
    .option('--species <species>', '指定物种筛选')
    .option('--rarity <rarity>', '指定稀有度筛选')
    .option('--shiny-only', '仅闪光')
    .option('--max-attempts <n>', '最大尝试次数', parsePositiveInt, 200000)
    .option('--no-hype', '关闭孵化情绪动画')
    .action(async options => {
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: options.shinyOnly,
        maxAttempts: options.maxAttempts,
        hype: options.hype,
      })
      await executeSwitch('random', filters, options.maxAttempts, options.hype)
    })

  program
    .command('target')
    .description('按目标条件刷宠物')
    .option('--species <species>', '目标物种')
    .option('--rarity <rarity>', '目标稀有度')
    .option('--shiny', '目标为闪光')
    .option('--max-attempts <n>', '最大尝试次数', parsePositiveInt, 1000000)
    .option('--no-hype', '关闭孵化情绪动画')
    .action(async options => {
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: options.shiny,
        maxAttempts: options.maxAttempts,
        hype: options.hype,
      })

      if (!hasAnyFilter(filters)) {
        throw new Error('target 模式至少要指定一个条件：--species / --rarity / --shiny')
      }

      await executeSwitch('target', filters, options.maxAttempts, options.hype)
    })

  program
    .command('prob')
    .description('查看稀有度与目标命中概率')
    .option('--species <species>', '目标物种')
    .option('--rarity <rarity>', '目标稀有度')
    .option('--shiny', '目标闪光')
    .action(options => {
      const filters = filtersFromOptions({
        species: options.species,
        rarity: options.rarity,
        shiny: options.shiny,
        maxAttempts: 1,
        hype: false,
      })

      const hasTarget = hasAnyFilter(filters)

      process.stdout.write(chalk.bold('=== 概率面板 ===\n'))
      process.stdout.write(`闪光概率：${formatPercent(0.01)}\n`)
      process.stdout.write(`稀有及以上概率：${formatPercent(rareOrBetterProbability())}\n`)
      process.stdout.write(`物种单项概率：${formatPercent(1 / SPECIES.length)}（1/${SPECIES.length}）\n\n`)

      process.stdout.write(chalk.bold('稀有度分布：\n'))
      for (const rarity of RARITIES) {
        const probability = rarityProbability(rarity)
        process.stdout.write(
          `- ${RARITY_ZH[rarity]}(${rarity})：${formatPercent(probability)}，期望 ${expectedAttempts(
            probability,
          ).toFixed(2)} 抽\n`,
        )
      }

      if (hasTarget) {
        const probability = combinedProbability(filters)
        const expected = expectedAttempts(probability)
        process.stdout.write(`\n${chalk.bold('目标条件：')} ${formatFilters(filters)}\n`)
        process.stdout.write(`${chalk.bold('命中概率：')} ${formatPercent(probability)}\n`)
        process.stdout.write(`${chalk.bold('期望抽数：')} ${expected.toFixed(2)}\n`)
      }
    })

  program
    .command('card')
    .description('展示当前宠物卡片')
    .action(() => {
      const state = readState()
      const config = readClaudeConfig()
      const { userId, source } = resolveEffectiveUserId(config)
      const roll = rollByUserId(userId)
      const signature = extractCompanionSignature(config.companion)
      const runtimeDrift = detectRuntimeDrift({
        switchTimestamp: state.lastSwitch?.timestamp,
        companionHatchedAt: readCompanionHatchedAt(config.companion),
      })

      const signatureRarityZh = signature.rarity ? RARITY_ZH[signature.rarity] : '未知'
      const signatureSpeciesZh = signature.species ? SPECIES_ZH[signature.species] : '未知'
      const hasMismatch =
        Boolean(signature.rarity && signature.rarity !== roll.bones.rarity) ||
        Boolean(signature.species && signature.species !== roll.bones.species)

      process.stdout.write(chalk.bold('=== 当前宠物 ===\n'))
      process.stdout.write(`种子来源：${source}\n`)
      process.stdout.write(`哈希模式：${hashModeLabel()}\n`)
      process.stdout.write(
        `种子值：${source === 'accountUuid' ? chalk.yellow(userId) : chalk.green(userId)}\n\n`,
      )
      process.stdout.write(chalk.bold('=== companion（当前配置）===\n'))
      process.stdout.write(`名称：${signature.name ?? '未设置'}\n`)
      process.stdout.write(`解析来源：${signature.source}\n`)
      process.stdout.write(`稀有度（配置侧）：${signatureRarityZh}\n`)
      process.stdout.write(`物种（配置侧）：${signatureSpeciesZh}\n`)
      if (signature.personality) {
        process.stdout.write(`个性：${signature.personality}\n`)
      }
      process.stdout.write('\n')
      process.stdout.write(chalk.bold('=== 种子推演骨架 ===\n'))
      process.stdout.write(`${renderBuddyCard(roll.bones)}\n`)

      if (hasMismatch) {
        process.stdout.write(`配置一致性：⚠️ 检测到配置 companion 与种子推演不一致，可执行 random/target 重新同步。\n`)
      } else {
        process.stdout.write('配置一致性：✅ companion 与种子推演一致。\n')
      }

      process.stdout.write(`${formatRuntimeDriftStatus(runtimeDrift)}\n`)
      if (runtimeDrift.status === 'stale_possible') {
        process.stdout.write(
          `${chalk.yellow('⚠️ 当前 Claude 左下角宠物可能仍是旧骨架，需重开会话后才会和本次切换一致。')}\n`,
        )
      }
    })

  program
    .command('undo')
    .description('回滚到上一次切换前的配置')
    .action(() => {
      const state = readState()
      if (!state.lastSwitch) {
        throw new Error('没有可回滚记录，请先执行 random 或 target')
      }

      const undoBackupPath = backupCurrentConfigForUndo(state.lastSwitch.configPath)
      restoreConfigFromBackup(state.lastSwitch.configPath, state.lastSwitch.backupPath)

      markUndo({
        timestamp: new Date().toISOString(),
        restoredFromBackup: state.lastSwitch.backupPath,
        undoBackupPath,
      })

      process.stdout.write(`${chalk.green('✅ 已回滚成功')}\n`)
      process.stdout.write(`恢复来源：${state.lastSwitch.backupPath}\n`)
      process.stdout.write(`当前前置备份：${undoBackupPath}\n`)
    })

  program
    .command('doctor')
    .description('检查 accountUuid 锁定与配置状态')
    .action(() => {
      const configPath = getClaudeConfigPath()
      const config = readClaudeConfig(configPath)
      const lock = hasAccountUuid(config)
      const { source } = resolveEffectiveUserId(config)
      const state = readState()
      const runtimeDrift = detectRuntimeDrift({
        switchTimestamp: state.lastSwitch?.timestamp,
        companionHatchedAt: readCompanionHatchedAt(config.companion),
      })

      process.stdout.write(chalk.bold('=== Buddy Doctor ===\n'))
      process.stdout.write(`配置路径：${configPath}\n`)
      process.stdout.write(`当前种子来源：${source}\n`)
      process.stdout.write(`当前哈希模式：${hashModeLabel()}\n`)
      process.stdout.write(`${renderDoctorMessage(lock)}\n`)
      process.stdout.write(`${formatRuntimeDriftStatus(runtimeDrift)}\n`)
      if (runtimeDrift.status === 'stale_possible') {
        process.stdout.write('说明：这不是算法映射错误，而是运行中的 Claude 会话尚未热更新到新 userID。\n')
      }
    })

  await program.parseAsync(process.argv)
}

main().catch(error => {
  process.stderr.write(`${chalk.red('❌ 执行失败：')}${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
