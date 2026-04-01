#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, cpSync, writeFileSync, chmodSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const RELEASE_DIR = join(ROOT, 'release')

const TARGETS = {
  'win-x64': {
    archiveExt: 'zip',
    archiveFileName: version => `node-v${version}-win-x64.zip`,
    outputZipName: 'buddy-switch-win-x64.zip',
  },
  'macos-arm64': {
    archiveExt: 'tar.gz',
    archiveFileName: version => `node-v${version}-darwin-arm64.tar.gz`,
    outputZipName: 'buddy-switch-macos-arm64.zip',
  },
}

function normalizeVersion(raw) {
  return raw.trim().replace(/^v/i, '')
}

function selectedTargets() {
  const raw = (process.env.BUDDY_PORTABLE_TARGETS ?? 'win-x64,macos-arm64').trim()
  const list = raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (list.length === 0) {
    throw new Error('BUDDY_PORTABLE_TARGETS 不能为空')
  }

  for (const target of list) {
    if (!(target in TARGETS)) {
      throw new Error(`不支持的目标平台：${target}`)
    }
  }

  return list
}

async function downloadFile(url, outputPath) {
  const maxAttempts = 3
  let lastError = new Error('unknown download error')
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rmSync(outputPath, { force: true })
      const response = await fetch(url)
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }
      await pipeline(response.body, createWriteStream(outputPath))
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt >= maxAttempts) {
        break
      }
      const backoffMs = attempt * 1500
      console.log(`[portable] 下载失败，${backoffMs}ms 后重试 (${attempt}/${maxAttempts})...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  throw new Error(`下载失败：${url}，原因：${lastError.message}`)
}

function run(cmd, args, cwd = ROOT) {
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
  })
}

function ensureCleanDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true })
  mkdirSync(dirPath, { recursive: true })
}

function extractArchive(archivePath, destinationDir, ext) {
  mkdirSync(destinationDir, { recursive: true })
  if (ext === 'zip') {
    if (process.platform === 'win32') {
      run('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${archivePath}" -DestinationPath "${destinationDir}" -Force`,
      ])
      return
    }
    run('unzip', ['-q', archivePath, '-d', destinationDir])
    return
  }

  run('tar', ['-xzf', archivePath, '-C', destinationDir])
}

function firstDirectory(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  const folder = entries.find(entry => entry.isDirectory())
  if (!folder) {
    throw new Error(`解压目录中未找到子目录：${dirPath}`)
  }
  return join(dirPath, folder.name)
}

function writePortableLaunchers(packageDir, target) {
  if (target === 'win-x64') {
    const buddySwitchCmd = `@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "NODE_EXE=%ROOT_DIR%runtime\\node.exe"
set "CLI_JS=%ROOT_DIR%app\\dist\\cli.js"

chcp 65001 >nul 2>&1
if errorlevel 1 set "BUDDY_FORCE_ASCII=1"
for /f "tokens=2 delims=: " %%A in ('chcp') do set "CODEPAGE=%%A"
if not "%CODEPAGE%"=="65001" set "BUDDY_FORCE_ASCII=1"

"%NODE_EXE%" "%CLI_JS%" %*
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
`

    const runWinCmd = `@echo off
setlocal

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

chcp 65001 >nul 2>&1
if errorlevel 1 set "BUDDY_FORCE_ASCII=1"
for /f "tokens=2 delims=: " %%A in ('chcp') do set "CODEPAGE=%%A"
if not "%CODEPAGE%"=="65001" set "BUDDY_FORCE_ASCII=1"

set "NODE_EXE=%ROOT_DIR%runtime\\node.exe"
set "CLI_JS=%ROOT_DIR%app\\dist\\cli.js"

if not "%~1"=="" goto run_args

echo [buddy-switch] Running default flow: doctor ^> prob ^> random ^> card
echo.
"%NODE_EXE%" "%CLI_JS%" doctor
echo.
"%NODE_EXE%" "%CLI_JS%" prob
echo.
"%NODE_EXE%" "%CLI_JS%" random
echo.
"%NODE_EXE%" "%CLI_JS%" card

:loop
echo.
set /p ANSWER=Input q to exit, press Enter to draw again, b save backup, l list backups, r restore by ID: 
if /I "%ANSWER%"=="q" goto finish
if /I "%ANSWER%"=="quit" goto finish
if /I "%ANSWER%"=="exit" goto finish
if /I "%ANSWER%"=="b" goto backup_save
if /I "%ANSWER%"=="backup" goto backup_save
if /I "%ANSWER%"=="l" goto backup_list
if /I "%ANSWER%"=="list" goto backup_list
if /I "%ANSWER%"=="r" goto backup_restore
if /I "%ANSWER%"=="restore" goto backup_restore

echo.
"%NODE_EXE%" "%CLI_JS%" random
echo.
"%NODE_EXE%" "%CLI_JS%" card
goto loop

:backup_save
echo.
set /p BACKUP_NAME=Backup name (optional, press Enter to skip): 
if "%BACKUP_NAME%"=="" (
  "%NODE_EXE%" "%CLI_JS%" backup save
) else (
  "%NODE_EXE%" "%CLI_JS%" backup save --name "%BACKUP_NAME%"
)
goto loop

:backup_list
echo.
"%NODE_EXE%" "%CLI_JS%" backup list
goto loop

:backup_restore
echo.
set /p BACKUP_ID=Input backup ID to restore: 
if "%BACKUP_ID%"=="" (
  echo [buddy-switch] backup ID is required.
  goto loop
)
"%NODE_EXE%" "%CLI_JS%" backup restore --id "%BACKUP_ID%"
goto loop

:run_args
"%NODE_EXE%" "%CLI_JS%" %*

:finish
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit %EXIT_CODE%
`

    writeFileSync(join(packageDir, 'buddy-switch.cmd'), buddySwitchCmd, 'utf8')
    writeFileSync(join(packageDir, 'run-win.cmd'), runWinCmd, 'utf8')
    return
  }

  const buddySwitchSh = `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$ROOT_DIR/runtime/bin/node"
CLI_JS="$ROOT_DIR/app/dist/cli.js"

exec "$NODE_BIN" "$CLI_JS" "$@"
`

  const runMacCommand = `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

run_cli() {
  "$ROOT_DIR/buddy-switch" "$@"
}

save_backup() {
  printf "Backup name (optional): "
  read -r backup_name
  if [ -n "${backup_name:-}" ]; then
    run_cli backup save --name "$backup_name"
  else
    run_cli backup save
  fi
}

restore_backup_by_id() {
  printf "Input backup ID to restore: "
  read -r backup_id
  if [ -z "${backup_id:-}" ]; then
    echo "[buddy-switch] backup ID is required."
    return
  fi
  run_cli backup restore --id "$backup_id"
}

if [ "$#" -eq 0 ]; then
  echo "[buddy-switch] Running default flow: doctor -> prob -> random -> card"
  echo
  run_cli doctor
  echo
  run_cli prob
  echo
  run_cli random
  echo
  run_cli card

  if [ -t 0 ]; then
    while true; do
      echo
      printf "\\033[37mInput q to exit\\033[0m, \\033[1;33mpress Enter to draw again\\033[0m, \\033[1;36mb save backup\\033[0m, \\033[1;34ml list backups\\033[0m, \\033[1;35mr restore by ID\\033[0m: "
      read -r answer
      case "$answer" in
        q|Q|quit|QUIT|exit|EXIT)
          exit 0
          ;;
        b|B|backup|BACKUP)
          echo
          save_backup
          ;;
        l|L|list|LIST)
          echo
          run_cli backup list
          ;;
        r|R|restore|RESTORE)
          echo
          restore_backup_by_id
          ;;
        *)
          echo
          run_cli random
          echo
          run_cli card
          ;;
      esac
    done
  fi
else
  run_cli "$@"
fi
`

  const buddySwitchPath = join(packageDir, 'buddy-switch')
  const runMacPath = join(packageDir, 'run-mac.command')
  writeFileSync(buddySwitchPath, buddySwitchSh, 'utf8')
  writeFileSync(runMacPath, runMacCommand, 'utf8')
  chmodSync(buddySwitchPath, 0o755)
  chmodSync(runMacPath, 0o755)
}

function zipDirectory(sourceDir, outputZipPath) {
  rmSync(outputZipPath, { force: true })
  const parent = resolve(sourceDir, '..')
  const name = basename(sourceDir)
  if (process.platform === 'win32') {
    run('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${join(parent, name)}" -DestinationPath "${outputZipPath}" -Force`,
    ])
    return
  }
  run('zip', ['-qry', outputZipPath, name], parent)
}

function copyAppFiles(appDir) {
  mkdirSync(appDir, { recursive: true })
  cpSync(join(ROOT, 'dist'), join(appDir, 'dist'), { recursive: true })
  cpSync(join(ROOT, 'package.json'), join(appDir, 'package.json'))
  if (existsSync(join(ROOT, 'package-lock.json'))) {
    cpSync(join(ROOT, 'package-lock.json'), join(appDir, 'package-lock.json'))
    run('npm', ['ci', '--omit=dev'], appDir)
    return
  }
  run('npm', ['install', '--omit=dev'], appDir)
}

async function packageTarget(target, runtimeVersion, workDir) {
  const config = TARGETS[target]
  const archiveName = config.archiveFileName(runtimeVersion)
  const archiveUrl = `https://nodejs.org/dist/v${runtimeVersion}/${archiveName}`
  const archivePath = join(workDir, archiveName)
  const extractDir = join(workDir, `${target}-extract`)

  console.log(`[portable] 下载 ${target} runtime: ${archiveUrl}`)
  await downloadFile(archiveUrl, archivePath)

  console.log(`[portable] 解压 ${target} runtime...`)
  extractArchive(archivePath, extractDir, config.archiveExt)
  const extractedRoot = firstDirectory(extractDir)

  const packageRoot = join(RELEASE_DIR, config.outputZipName.replace(/\.zip$/i, ''))
  const runtimeDir = join(packageRoot, 'runtime')
  const appDir = join(packageRoot, 'app')
  ensureCleanDir(packageRoot)

  cpSync(extractedRoot, runtimeDir, { recursive: true })
  copyAppFiles(appDir)
  writePortableLaunchers(packageRoot, target)

  const zipPath = join(RELEASE_DIR, config.outputZipName)
  console.log(`[portable] 生成压缩包 ${zipPath}`)
  zipDirectory(packageRoot, zipPath)
}

async function main() {
  const runtimeVersion = normalizeVersion(process.env.NODE_RUNTIME_VERSION ?? process.version)
  const targets = selectedTargets()

  console.log(`[portable] 使用 Node Runtime 版本: v${runtimeVersion}`)
  console.log(`[portable] 目标平台: ${targets.join(', ')}`)

  rmSync(join(ROOT, 'dist'), { recursive: true, force: true })
  run('npm', ['run', 'build'])

  ensureCleanDir(RELEASE_DIR)
  const workDir = join(os.tmpdir(), `buddy-switch-portable-${Date.now()}`)
  ensureCleanDir(workDir)

  try {
    for (const target of targets) {
      await packageTarget(target, runtimeVersion, workDir)
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  console.log('[portable] 打包完成。')
  for (const target of targets) {
    console.log(`- ${TARGETS[target].outputZipName}`)
  }
}

main().catch(error => {
  console.error(`[portable] 失败: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
