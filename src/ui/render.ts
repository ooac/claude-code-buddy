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
import { isAsciiMode, pickText } from './output-mode.js'

const RARITY_EN: Record<Rarity, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
}

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
  const ascii = isAsciiMode()
  const parts: string[] = []
  if (filters.species) {
    parts.push(
      pickText(`物种=${SPECIES_ZH[filters.species]}(${filters.species})`, `species=${filters.species}`),
    )
  }
  if (filters.rarity) {
    parts.push(
      pickText(`稀有度=${RARITY_ZH[filters.rarity]}(${filters.rarity})`, `rarity=${filters.rarity}`),
    )
  }
  if (typeof filters.shiny === 'boolean') {
    parts.push(pickText(`闪光=${filters.shiny ? '是' : '否'}`, `shiny=${filters.shiny ? 'yes' : 'no'}`))
  }
  return parts.length > 0 ? parts.join(ascii ? ', ' : '，') : pickText('无筛选（完全随机）', 'no filter (fully random)')
}

export function renderBuddyCard(bones: BuddyBones): string {
  const ascii = isAsciiMode()
  const header = colorRarity(
    `${RARITY_STARS[bones.rarity]} ${ascii ? RARITY_EN[bones.rarity] : RARITY_ZH[bones.rarity]} ${bones.shiny ? 'SHINY' : ''}`.trim(),
    bones.rarity,
  )

  const lines = [
    chalk.bold(pickText('=== Buddy 卡片 ===', '=== Buddy Card ===')),
    pickText(`稀有度：${header}`, `Rarity: ${header}`),
    pickText(`物种：${SPECIES_ZH[bones.species]} (${bones.species})`, `Species: ${bones.species}`),
    pickText(`眼睛：${bones.eye}`, `Eye: ${bones.eye}`),
    pickText(`帽子：${bones.hat}`, `Hat: ${bones.hat}`),
    pickText('属性：', 'Stats:'),
  ]

  for (const stat of STAT_NAMES) {
    lines.push(`  - ${stat.padEnd(9, ' ')} ${bones.stats[stat]}`)
  }

  return lines.join('\n')
}

export function renderDoctorMessage(hasLock: boolean): string {
  if (!hasLock) {
    return [
      chalk.green(pickText('✅ 当前未检测到 accountUuid 锁定。', '[OK] accountUuid lock not detected.')),
      pickText('说明：/buddy 将使用 userID 作为种子，一键切换通常会生效。', 'Info: /buddy uses userID as seed, switching usually works.'),
    ].join('\n')
  }

  return [
    chalk.yellow(pickText('⚠️ 检测到 accountUuid 锁定。', '[WARN] accountUuid lock detected.')),
    pickText(
      '说明：Claude Code /buddy 优先使用 accountUuid，单独修改 userID 可能不会生效。',
      'Info: Claude Code /buddy prefers accountUuid. Changing userID alone may not take effect.',
    ),
    pickText('建议：', 'Suggestions:'),
    pickText('1. 先保留当前 ~/.claude.json 备份。', '1. Backup current ~/.claude.json first.'),
    pickText('2. 在隔离环境测试 token 登录方案，再决定是否切换。', '2. Test token login in isolated env before switching.'),
    pickText('3. 继续执行本工具也可用于概率模拟与目标搜索。', '3. This tool can still be used for probability simulation and targeting.'),
  ].join('\n')
}
