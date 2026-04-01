import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { CONFIG_PATH_ENV, STATE_PATH_ENV, resolvePathOptions } from './path-options.js'

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const backup: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    backup[key] = process.env[key]
    if (typeof value === 'string') {
      process.env[key] = value
    } else {
      delete process.env[key]
    }
  }

  try {
    return fn()
  } finally {
    for (const [key, value] of Object.entries(backup)) {
      if (typeof value === 'string') {
        process.env[key] = value
      } else {
        delete process.env[key]
      }
    }
  }
}

describe('path-options', () => {
  it('CLI 参数优先于环境变量', () => {
    const result = withEnv(
      {
        [CONFIG_PATH_ENV]: '/tmp/env-config.json',
        [STATE_PATH_ENV]: '/tmp/env-state.json',
      },
      () =>
        resolvePathOptions({
          configPath: '/tmp/arg-config.json',
          statePath: '/tmp/arg-state.json',
        }),
    )

    expect(result.configPath).toBe('/tmp/arg-config.json')
    expect(result.statePath).toBe('/tmp/arg-state.json')
  })

  it('环境变量优先于默认 HOME 路径，且支持相对路径自动绝对化', () => {
    const result = withEnv(
      {
        [CONFIG_PATH_ENV]: './fixtures/配置 空格/custom-config.json',
        [STATE_PATH_ENV]: './fixtures/配置 空格/custom-state.json',
      },
      () => resolvePathOptions(),
    )

    expect(result.configPath).toBe(resolve('./fixtures/配置 空格/custom-config.json'))
    expect(result.statePath).toBe(resolve('./fixtures/配置 空格/custom-state.json'))
  })

  it('未提供参数与环境变量时回落到默认路径', () => {
    const result = withEnv(
      {
        [CONFIG_PATH_ENV]: undefined,
        [STATE_PATH_ENV]: undefined,
      },
      () => resolvePathOptions(),
    )

    expect(result.configPath.endsWith('/.claude.json') || result.configPath.endsWith('\\.claude.json')).toBe(true)
    expect(
      result.statePath.endsWith('/.buddy-switch/state.json') ||
        result.statePath.endsWith('\\.buddy-switch\\state.json'),
    ).toBe(true)
  })
})
