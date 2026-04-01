import readline from 'node:readline/promises'
import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process'

export type RestoreConfirmResult =
  | 'confirmed'
  | 'declined'
  | 'skipped_non_interactive'

export type ConfirmIO = {
  stdin: NodeJS.ReadStream
  stdout: NodeJS.WriteStream
}

function isAffirmative(input: string): boolean {
  const normalized = input.trim().toLowerCase()
  return normalized === 'y' || normalized === 'yes'
}

export async function confirmSafetyBackup(io: ConfirmIO = {
  stdin: defaultStdin,
  stdout: defaultStdout,
}): Promise<RestoreConfirmResult> {
  if (!io.stdin.isTTY || !io.stdout.isTTY) {
    return 'skipped_non_interactive'
  }

  const rl = readline.createInterface({ input: io.stdin, output: io.stdout })
  try {
    const answer = await rl.question('是否先为当前配置创建保护备份？(y/N): ')
    return isAffirmative(answer) ? 'confirmed' : 'declined'
  } finally {
    rl.close()
  }
}

export function __testOnlyIsAffirmative(input: string): boolean {
  return isAffirmative(input)
}
