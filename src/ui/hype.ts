import chalk from 'chalk'
import { rareOrBetterProbability } from '../core/probability.js'
import { type BuddyBones, RARITY_ZH, SPECIES_ZH } from '../core/types.js'
import { isAsciiMode, pickIcon, pickText } from './output-mode.js'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function stage(text: string, delayMs: number): Promise<void> {
  process.stdout.write(`${text}\n`)
  await sleep(delayMs)
}

export type HypeInput = {
  bones: BuddyBones
  attempts: number
  unluckyStreak: number
  enabled: boolean
}

function gradeMessage(bones: BuddyBones): string {
  const ascii = isAsciiMode()
  if (bones.shiny && bones.rarity === 'legendary') {
    return chalk.yellowBright.bold(
      pickText('金色传说！闪光传说双暴击，今天就是你的主场。', 'Legendary + Shiny! This is your run.'),
    )
  }
  if (bones.shiny) {
    return chalk.yellow(pickText('闪光出货！这波欧气直接拉满。', 'Shiny hit! Luck is maxed out.'))
  }
  if (bones.rarity === 'legendary') {
    return chalk.yellowBright(pickText('传说降临！强度党宣布胜利。', 'Legendary landed!'))
  }
  if (bones.rarity === 'epic') {
    return chalk.magenta(pickText('史诗出货！这只绝对值得炫耀。', 'Epic hit! Worth showing off.'))
  }
  if (bones.rarity === 'rare') {
    return chalk.cyan(pickText('稀有到手！已经明显高于日常运气。', 'Rare acquired! Above average luck.'))
  }
  if (bones.rarity === 'uncommon') {
    return chalk.green(pickText('非凡稳落地，今天状态不错。', 'Uncommon landed. Nice momentum.'))
  }
  return chalk.gray(pickText('普通出货，但别急，下一发随时逆天改命。', 'Common hit. Next one can still pop off.'))
}

function consolationMessage(unluckyStreak: number): string | undefined {
  if (unluckyStreak < 5) {
    return undefined
  }

  const nextRare = (rareOrBetterProbability() * 100).toFixed(2)
  return chalk.yellow(
    pickText(
      `你已经连续 ${unluckyStreak} 次非酋，别慌。下一抽稀有及以上概率仍有 ${nextRare}%。`,
      `You are ${unluckyStreak} pulls dry. Rare+ chance is still ${nextRare}% next roll.`,
    ),
  )
}

export async function playHatchHype(input: HypeInput): Promise<void> {
  if (!input.enabled) {
    return
  }

  await stage(chalk.blue(`${pickIcon('⚡ ', '')}${pickText('蓄力中：正在对齐命运种子...', 'Charging: aligning seed...')}`), 120)
  await stage(chalk.magenta(`${pickIcon('🥚 ', '')}${pickText('开蛋中：概率之门已开启...', 'Hatching: probability gate open...')}`), 140)
  await stage(chalk.cyan(`${pickIcon('✨ ', '')}${pickText('揭晓中：新宠物正在冲向你的终端...', 'Reveal: your new buddy is arriving...')}`), 120)

  const petLabel = pickText(`${SPECIES_ZH[input.bones.species]} (${input.bones.species})`, input.bones.species)
  const rarityLabel = pickText(RARITY_ZH[input.bones.rarity], input.bones.rarity)
  await stage(
    `${pickIcon('🎉 ', '')}${pickText('已孵化', 'Hatched')}: ${petLabel} | ${rarityLabel}${input.bones.shiny ? ` | ${pickText('闪光', 'shiny')}` : ''}`,
    60,
  )

  process.stdout.write(`${gradeMessage(input.bones)}\n`)
  process.stdout.write(chalk.gray(pickText(`本次命中耗时：第 ${input.attempts} 次尝试。\n`, `Attempts used: ${input.attempts}.\n`)))

  const consolation = consolationMessage(input.unluckyStreak)
  if (consolation) {
    process.stdout.write(`${consolation}\n`)
  }
}
