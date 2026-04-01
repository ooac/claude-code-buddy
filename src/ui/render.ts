import chalk from 'chalk'
import {
  type BuddyBones,
  RARITY_STARS,
  RARITY_ZH,
  type RollFilters,
  SPECIES_ZH,
  STAT_NAMES,
  type Rarity,
} from '../core/types.js'

function colorRarity(text: string, rarity: Rarity): string {
  switch (rarity) {
    case 'legendary':
      return chalk.yellowBright.bold(text)
    case 'epic':
      return chalk.magentaBright(text)
    case 'rare':
      return chalk.cyanBright(text)
    case 'uncommon':
      return chalk.greenBright(text)
    default:
      return chalk.gray(text)
  }
}

export function formatFilters(filters: RollFilters): string {
  const parts: string[] = []
  if (filters.species) {
    parts.push(`物种=${SPECIES_ZH[filters.species]}(${filters.species})`)
  }
  if (filters.rarity) {
    parts.push(`稀有度=${RARITY_ZH[filters.rarity]}(${filters.rarity})`)
  }
  if (typeof filters.shiny === 'boolean') {
    parts.push(`闪光=${filters.shiny ? '是' : '否'}`)
  }
  return parts.length > 0 ? parts.join('，') : '无筛选（完全随机）'
}

export function renderBuddyCard(bones: BuddyBones): string {
  const header = colorRarity(
    `${RARITY_STARS[bones.rarity]} ${RARITY_ZH[bones.rarity]} ${bones.shiny ? '✨ SHINY' : ''}`.trim(),
    bones.rarity,
  )

  const lines = [
    chalk.bold('=== Buddy 卡片 ==='),
    `稀有度：${header}`,
    `物种：${SPECIES_ZH[bones.species]} (${bones.species})`,
    `眼睛：${bones.eye}`,
    `帽子：${bones.hat}`,
    '属性：',
  ]

  for (const stat of STAT_NAMES) {
    lines.push(`  - ${stat.padEnd(9, ' ')} ${bones.stats[stat]}`)
  }

  return lines.join('\n')
}

export function renderDoctorMessage(hasLock: boolean): string {
  if (!hasLock) {
    return [
      chalk.green('✅ 当前未检测到 accountUuid 锁定。'),
      '说明：/buddy 将使用 userID 作为种子，一键切换通常会生效。',
    ].join('\n')
  }

  return [
    chalk.yellow('⚠️ 检测到 accountUuid 锁定。'),
    '说明：Claude Code /buddy 优先使用 accountUuid，单独修改 userID 可能不会生效。',
    '建议：',
    '1. 先保留当前 ~/.claude.json 备份。',
    '2. 在隔离环境测试 token 登录方案，再决定是否切换。',
    '3. 继续执行本工具也可用于概率模拟与目标搜索。',
  ].join('\n')
}
