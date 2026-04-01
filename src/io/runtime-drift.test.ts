import { describe, expect, it } from 'vitest'
import { detectRuntimeDrift, evaluateRuntimeDrift, formatRuntimeDriftStatus } from './runtime-drift.js'

describe('runtime-drift', () => {
  it('无 Claude 进程时返回 no_claude_process', () => {
    const result = evaluateRuntimeDrift([], Date.now())
    expect(result.status).toBe('no_claude_process')
    expect(result.reason).toBe('no_process')
  })

  it('进程启动晚于切换时间时返回 safe', () => {
    const switchAtMs = 1_700_000_000_000
    const result = evaluateRuntimeDrift(
      [
        { pid: 100, startedAtMs: switchAtMs + 10_000 },
        { pid: 101, startedAtMs: switchAtMs + 30_000 },
      ],
      switchAtMs,
    )

    expect(result.status).toBe('safe')
    expect(result.reason).toBe('process_newer_than_switch')
  })

  it('进程启动早于切换时间时返回 stale_possible', () => {
    const switchAtMs = 1_700_000_000_000
    const result = evaluateRuntimeDrift(
      [
        { pid: 201, startedAtMs: switchAtMs - 60_000 },
        { pid: 202, startedAtMs: switchAtMs + 1_000 },
      ],
      switchAtMs,
    )

    expect(result.status).toBe('stale_possible')
    expect(result.reason).toBe('process_older_than_switch')
    expect(formatRuntimeDriftStatus(result)).toContain('可能未热更新 userID')
  })

  it('支持通过环境变量强制结果（用于集成测试）', () => {
    const original = process.env.BUDDY_RUNTIME_DRIFT_FORCE
    process.env.BUDDY_RUNTIME_DRIFT_FORCE = 'stale_possible'
    try {
      const result = detectRuntimeDrift({ switchTimestamp: new Date().toISOString() })
      expect(result.status).toBe('stale_possible')
      expect(result.reason).toBe('forced')
    } finally {
      if (typeof original === 'string') {
        process.env.BUDDY_RUNTIME_DRIFT_FORCE = original
      } else {
        delete process.env.BUDDY_RUNTIME_DRIFT_FORCE
      }
    }
  })
})
