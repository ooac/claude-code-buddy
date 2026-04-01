import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import os from 'node:os'

export type ClaudeConfig = {
  userID?: string
  oauthAccount?: {
    accountUuid?: string
    [key: string]: unknown
  }
  companion?: unknown
  [key: string]: unknown
}

export type SwitchMutationResult = {
  configPath: string
  backupPath: string
  previousUserId?: string
  newUserId: string
  config: ClaudeConfig
}

export type SwitchMutationOptions = {
  companion?: unknown
}

export function getClaudeConfigPath(homeDir = os.homedir()): string {
  return join(homeDir, '.claude.json')
}

function ensureParentDir(filePath: string): void {
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
}

function timestampToken(date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function readRawConfig(configPath: string): string {
  if (!existsSync(configPath)) {
    return '{}\n'
  }
  return readFileSync(configPath, 'utf8')
}

function parseConfig(raw: string, configPath: string): ClaudeConfig {
  try {
    const parsed = JSON.parse(raw) as ClaudeConfig
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('配置文件不是有效对象')
    }
    return parsed
  } catch (error) {
    throw new Error(`读取配置失败：${configPath} 不是合法 JSON。${String(error)}`)
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  ensureParentDir(filePath)
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`
  const payload = `${JSON.stringify(value, null, 2)}\n`
  writeFileSync(tempPath, payload, 'utf8')
  renameSync(tempPath, filePath)
}

export function readClaudeConfig(configPath = getClaudeConfigPath()): ClaudeConfig {
  const raw = readRawConfig(configPath)
  return parseConfig(raw, configPath)
}

export function resolveEffectiveUserId(config: ClaudeConfig): {
  userId: string
  source: 'accountUuid' | 'userID' | 'anon'
} {
  const accountUuid = config.oauthAccount?.accountUuid
  if (typeof accountUuid === 'string' && accountUuid.length > 0) {
    return { userId: accountUuid, source: 'accountUuid' }
  }
  if (typeof config.userID === 'string' && config.userID.length > 0) {
    return { userId: config.userID, source: 'userID' }
  }
  return { userId: 'anon', source: 'anon' }
}

export function hasAccountUuid(config: ClaudeConfig): boolean {
  return typeof config.oauthAccount?.accountUuid === 'string' && config.oauthAccount.accountUuid.length > 0
}

export function switchUserIdWithBackup(
  newUserId: string,
  configPath = getClaudeConfigPath(),
  options?: SwitchMutationOptions,
): SwitchMutationResult {
  if (!newUserId || newUserId.trim().length === 0) {
    throw new Error('newUserId 不能为空')
  }

  const raw = readRawConfig(configPath)
  const backupPath = `${configPath}.buddy-switch.${timestampToken()}.bak`
  writeFileSync(backupPath, raw, 'utf8')

  const config = parseConfig(raw, configPath)
  const previousUserId = typeof config.userID === 'string' ? config.userID : undefined
  const nextConfig: ClaudeConfig = {
    ...config,
    userID: newUserId,
  }
  if (typeof options !== 'undefined' && 'companion' in options) {
    nextConfig.companion = options.companion
  }

  try {
    writeJsonAtomic(configPath, nextConfig)
  } catch (error) {
    // 写入失败自动回滚
    copyFileSync(backupPath, configPath)
    throw new Error(`写入配置失败，已回滚。${String(error)}`)
  }

  return {
    configPath,
    backupPath,
    previousUserId,
    newUserId,
    config: nextConfig,
  }
}

export function restoreConfigFromBackup(configPath: string, backupPath: string): void {
  if (!existsSync(backupPath)) {
    throw new Error(`找不到备份文件：${backupPath}`)
  }
  copyFileSync(backupPath, configPath)
}

export function backupCurrentConfigForUndo(configPath = getClaudeConfigPath()): string {
  const backupPath = `${configPath}.buddy-switch.undo.${timestampToken()}.bak`
  const raw = readRawConfig(configPath)
  writeFileSync(backupPath, raw, 'utf8')
  return backupPath
}
