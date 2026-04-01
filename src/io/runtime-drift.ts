import { execFileSync } from 'node:child_process'

export type RuntimeDriftStatus = 'safe' | 'stale_possible' | 'no_claude_process'

export type RuntimeDriftResult = {
  status: RuntimeDriftStatus
  switchAtMs?: number
  processStartedAtMs?: number
  pid?: number
  reason:
    | 'forced'
    | 'no_process'
    | 'no_switch_time'
    | 'process_newer_than_switch'
    | 'process_older_than_switch'
}

type ClaudeProcessInfo = {
  pid: number
  startedAtMs: number
}

const FORCE_ENV = 'BUDDY_RUNTIME_DRIFT_FORCE'

function parseDateToMs(value: string): number | undefined {
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

function looksLikeClaudeProcess(command: string): boolean {
  const normalized = command.toLowerCase()
  if (normalized.includes('buddy-switch')) {
    return false
  }
  if (/(^|[\s/])claude(\s|$)/.test(normalized)) {
    return true
  }
  if (normalized.includes('/.local/share/claude/versions/')) {
    return true
  }
  return false
}

function parsePsLine(line: string): ClaudeProcessInfo | undefined {
  const match = line.match(
    /^\s*(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.+)$/,
  )
  if (!match) {
    return undefined
  }

  const pid = Number.parseInt(match[1] ?? '', 10)
  const startRaw = match[2] ?? ''
  const command = match[3] ?? ''
  if (!Number.isFinite(pid) || pid <= 0) {
    return undefined
  }
  if (!looksLikeClaudeProcess(command)) {
    return undefined
  }

  const startedAtMs = parseDateToMs(startRaw)
  if (typeof startedAtMs !== 'number') {
    return undefined
  }

  return { pid, startedAtMs }
}

function listClaudeProcesses(): ClaudeProcessInfo[] {
  try {
    const output = execFileSync('ps', ['-axo', 'pid=,lstart=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    return output
      .split('\n')
      .map(line => parsePsLine(line))
      .filter((info): info is ClaudeProcessInfo => Boolean(info))
  } catch {
    return []
  }
}

function forcedResultFromEnv(
  switchAtMs?: number,
): RuntimeDriftResult | undefined {
  const raw = (process.env[FORCE_ENV] ?? '').trim().toLowerCase()
  if (!raw) {
    return undefined
  }

  if (raw === 'stale' || raw === 'stale_possible') {
    return {
      status: 'stale_possible',
      switchAtMs,
      reason: 'forced',
    }
  }
  if (raw === 'safe') {
    return {
      status: 'safe',
      switchAtMs,
      reason: 'forced',
    }
  }
  if (raw === 'none' || raw === 'no_process' || raw === 'no_claude_process') {
    return {
      status: 'no_claude_process',
      switchAtMs,
      reason: 'forced',
    }
  }

  return undefined
}

export function evaluateRuntimeDrift(
  processes: ClaudeProcessInfo[],
  switchAtMs?: number,
): RuntimeDriftResult {
  if (processes.length === 0) {
    return {
      status: 'no_claude_process',
      switchAtMs,
      reason: 'no_process',
    }
  }

  const oldestProcess = processes.reduce((oldest, current) => {
    if (!oldest) {
      return current
    }
    return current.startedAtMs < oldest.startedAtMs ? current : oldest
  }, undefined as ClaudeProcessInfo | undefined)

  if (!oldestProcess) {
    return {
      status: 'no_claude_process',
      switchAtMs,
      reason: 'no_process',
    }
  }

  if (typeof switchAtMs !== 'number' || !Number.isFinite(switchAtMs)) {
    return {
      status: 'safe',
      processStartedAtMs: oldestProcess.startedAtMs,
      pid: oldestProcess.pid,
      reason: 'no_switch_time',
    }
  }

  if (oldestProcess.startedAtMs < switchAtMs) {
    return {
      status: 'stale_possible',
      switchAtMs,
      processStartedAtMs: oldestProcess.startedAtMs,
      pid: oldestProcess.pid,
      reason: 'process_older_than_switch',
    }
  }

  return {
    status: 'safe',
    switchAtMs,
    processStartedAtMs: oldestProcess.startedAtMs,
    pid: oldestProcess.pid,
    reason: 'process_newer_than_switch',
  }
}

export function detectRuntimeDrift(options?: {
  switchTimestamp?: string
  switchAtMs?: number
  companionHatchedAt?: number
}): RuntimeDriftResult {
  const switchAtMs =
    options?.switchAtMs ??
    parseDateToMs(options?.switchTimestamp ?? '') ??
    (typeof options?.companionHatchedAt === 'number' ? options.companionHatchedAt : undefined)

  const forced = forcedResultFromEnv(switchAtMs)
  if (forced) {
    return forced
  }

  const processes = listClaudeProcesses()
  return evaluateRuntimeDrift(processes, switchAtMs)
}

export function formatRuntimeDriftStatus(result: RuntimeDriftResult): string {
  if (result.status === 'safe') {
    if (result.reason === 'no_switch_time') {
      return '运行态一致性：✅ 无切换基准，当前无法发现运行态漂移。'
    }
    return '运行态一致性：✅ 未发现运行态漂移。'
  }

  if (result.status === 'no_claude_process') {
    return '运行态一致性：ℹ️ 未检测到运行中的 Claude 进程。'
  }

  return '运行态一致性：⚠️ 检测到运行中 Claude 可能未热更新 userID，建议重开会话。'
}
