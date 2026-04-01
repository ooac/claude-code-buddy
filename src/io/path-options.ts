import { isAbsolute, resolve } from 'node:path'
import { getClaudeConfigPath } from './claude-config.js'
import { getStatePath } from './state.js'

export const CONFIG_PATH_ENV = 'BUDDY_CONFIG_PATH'
export const STATE_PATH_ENV = 'BUDDY_STATE_PATH'

export type PathOverridesInput = {
  configPath?: string
  statePath?: string
}

export type ResolvedPathOptions = {
  configPath: string
  statePath: string
}

function normalizePathInput(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  // 允许用户传相对路径，但统一规范为绝对路径，保证可迁移时行为稳定。
  return isAbsolute(trimmed) ? trimmed : resolve(trimmed)
}

export function resolvePathOptions(input?: PathOverridesInput): ResolvedPathOptions {
  const configPath =
    normalizePathInput(input?.configPath) ??
    normalizePathInput(process.env[CONFIG_PATH_ENV]) ??
    getClaudeConfigPath()
  const statePath =
    normalizePathInput(input?.statePath) ??
    normalizePathInput(process.env[STATE_PATH_ENV]) ??
    getStatePath()

  return { configPath, statePath }
}

