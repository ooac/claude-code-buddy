import chalk from 'chalk'
import { rareOrBetterProbability } from '../core/probability.js'
import { type BuddyBones, RARITY_ZH, SPECIES_ZH } from '../core/types.js'

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
  if (bones.shiny && bones.rarity === 'legendary') {
    return chalk.yellowBright.bold('金色传说！闪光传说双暴击，今天就是你的主场。')
  }
  if (bones.shiny) {
    return chalk.yellow('闪光出货！这波欧气直接拉满。')
  }
  if (bones.rarity === 'legendary') {
    return chalk.yellowBright('传说降临！强度党宣布胜利。')
  }
  if (bones.rarity === 'epic') {
    return chalk.magenta('史诗出货！这只绝对值得炫耀。')
  }
  if (bones.rarity === 'rare') {
    return chalk.cyan('稀有到手！已经明显高于日常运气。')
  }
  if (bones.rarity === 'uncommon') {
    return chalk.green('非凡稳落地，今天状态不错。')
  }
  return chalk.gray('普通出货，但别急，下一发随时逆天改命。')
}

function consolationMessage(unluckyStreak: number): string | undefined {
  if (unluckyStreak < 5) {
    return undefined
  }

  const nextRare = (rareOrBetterProbability() * 100).toFixed(2)
  return chalk.yellow(
    `你已经连续 ${unluckyStreak} 次非酋，别慌。下一抽稀有及以上概率仍有 ${nextRare}%。`,
  )
}

export async function playHatchHype(input: HypeInput): Promise<void> {
  if (!input.enabled) {
    return
  }

  await stage(chalk.blue('⚡ 蓄力中：正在对齐命运种子...'), 120)
  await stage(chalk.magenta('🥚 开蛋中：概率之门已开启...'), 140)
  await stage(chalk.cyan('✨ 揭晓中：新宠物正在冲向你的终端...'), 120)

  const petLabel = `${SPECIES_ZH[input.bones.species]} (${input.bones.species})`
  await stage(
    `🎉 已孵化：${petLabel}｜${RARITY_ZH[input.bones.rarity]}${input.bones.shiny ? '｜闪光' : ''}`,
    60,
  )

  process.stdout.write(`${gradeMessage(input.bones)}\n`)
  process.stdout.write(chalk.gray(`本次命中耗时：第 ${input.attempts} 次尝试。\n`))

  const consolation = consolationMessage(input.unluckyStreak)
  if (consolation) {
    process.stdout.write(`${consolation}\n`)
  }
}
