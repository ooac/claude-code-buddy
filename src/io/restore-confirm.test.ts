import { describe, expect, it } from 'vitest'
import { __testOnlyIsAffirmative, confirmSafetyBackup } from './restore-confirm.js'

describe('restore-confirm', () => {
  it('y / yes 判定为确认', () => {
    expect(__testOnlyIsAffirmative('y')).toBe(true)
    expect(__testOnlyIsAffirmative('Y')).toBe(true)
    expect(__testOnlyIsAffirmative(' yes ')).toBe(true)
  })

  it('其他输入判定为未确认', () => {
    expect(__testOnlyIsAffirmative('')).toBe(false)
    expect(__testOnlyIsAffirmative('n')).toBe(false)
    expect(__testOnlyIsAffirmative('random')).toBe(false)
  })

  it('非交互环境默认跳过保护备份', async () => {
    const result = await confirmSafetyBackup({
      stdin: { isTTY: false } as NodeJS.ReadStream,
      stdout: { isTTY: false } as NodeJS.WriteStream,
    })
    expect(result).toBe('skipped_non_interactive')
  })
})
