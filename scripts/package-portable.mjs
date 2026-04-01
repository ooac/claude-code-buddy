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

echo [buddy-switch] Standby mode: no auto draw on startup.
echo [buddy-switch] Tips: press Enter to draw, input b to backup, input c to browse/restore, input q to exit.
echo.

:loop
echo.
echo Shortcuts: b save backup ^| c browse/restore backups
set /p ANSWER=Input q to exit, press Enter to draw again: 
if "%ANSWER%"=="" goto draw_random
if /I "%ANSWER%"=="q" goto finish
if /I "%ANSWER%"=="quit" goto finish
if /I "%ANSWER%"=="exit" goto finish
if /I "%ANSWER%"=="b" goto backup_save
if /I "%ANSWER%"=="backup" goto backup_save
if /I "%ANSWER%"=="c" goto backup_browser_mode
if /I "%ANSWER%"=="check" goto backup_browser_mode
if /I "%ANSWER%"=="list" goto backup_browser_mode

echo [buddy-switch] Unsupported input. Press Enter to draw, or input b/c/q.
goto loop

:draw_random
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

:backup_browser_mode
:backup_browser_loop
echo.
set "BUDDY_LIST_TMP=%TEMP%\\buddy-switch-backup-list-%RANDOM%-%RANDOM%.txt"
"%NODE_EXE%" "%CLI_JS%" backup list > "%BUDDY_LIST_TMP%"
type "%BUDDY_LIST_TMP%"
set /p BACKUP_ACTION=Input q to return, or 1-5 to restore: 
if /I "%BACKUP_ACTION%"=="q" (
  del /q "%BUDDY_LIST_TMP%" >nul 2>&1
  goto loop
)
echo %BACKUP_ACTION%| findstr /r "^[1-5]$" >nul
if errorlevel 1 (
  echo [buddy-switch] only supports 1-5 or q.
  del /q "%BUDDY_LIST_TMP%" >nul 2>&1
  goto backup_browser_loop
)
findstr /c:"- [%BACKUP_ACTION%] ID:" "%BUDDY_LIST_TMP%" >nul
if errorlevel 1 (
  echo [buddy-switch] backup index %BACKUP_ACTION% is not in the current list.
  del /q "%BUDDY_LIST_TMP%" >nul 2>&1
  goto backup_browser_loop
)
del /q "%BUDDY_LIST_TMP%" >nul 2>&1
"%NODE_EXE%" "%CLI_JS%" backup restore --index "%BACKUP_ACTION%"
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
  if [ -n "$backup_name" ]; then
    run_cli backup save --name "$backup_name"
  else
    run_cli backup save
  fi
}

colorize_backup_indexes() {
  printf "%s\\n" "$1" | sed -E $'s/\\[1\\]/[\\033[1;33m1\\033[0m]/g; s/\\[2\\]/[\\033[1;33m2\\033[0m]/g; s/\\[3\\]/[\\033[1;33m3\\033[0m]/g; s/\\[4\\]/[\\033[1;33m4\\033[0m]/g; s/\\[5\\]/[\\033[1;33m5\\033[0m]/g'
}

backup_browser_mode() {
  while true; do
    echo
    backup_list_output="$(run_cli backup list)"
    colorized_backup_list_output="$(colorize_backup_indexes "$backup_list_output")"
    printf "%s\\n" "$colorized_backup_list_output"
    printf "\\033[37mInput q to return\\033[0m, \\033[1;33minput 1-5 to restore\\033[0m: "
    read -r backup_action
    case "$backup_action" in
      q|Q|quit|QUIT|exit|EXIT)
        return
        ;;
      [1-5])
        if ! printf "%s\n" "$backup_list_output" | grep -Fq -- "- [$backup_action] ID:"; then
          echo "[buddy-switch] backup index $backup_action is not in the current list."
          continue
        fi
        run_cli backup restore --index "$backup_action"
        return
        ;;
      *)
        echo "[buddy-switch] only supports 1-5 or q."
        ;;
    esac
  done
}

if [ "$#" -eq 0 ]; then
  echo "[buddy-switch] Standby mode: no auto draw on startup."
  echo "[buddy-switch] Tips: press Enter to draw, input b to backup, input c to browse/restore, input q to exit."

  if [ -t 0 ]; then
    while true; do
      echo
      printf "\\033[1;36mShortcuts: b save backup | c browse/restore backups\\033[0m\\n"
      printf "\\033[37mInput q to exit\\033[0m, \\033[1;33mpress Enter to draw again\\033[0m: "
      read -r answer
      case "$answer" in
        '')
          echo
          run_cli random
          echo
          run_cli card
          ;;
        q|Q|quit|QUIT|exit|EXIT)
          exit 0
          ;;
        b|B|backup|BACKUP)
          echo
          save_backup
          ;;
        c|C|check|CHECK|list|LIST)
          backup_browser_mode
          ;;
        *)
          echo "[buddy-switch] Unsupported input. Press Enter to draw, or input b/c/q."
          ;;
      esac
    done
  else
    echo "[buddy-switch] Non-interactive mode detected; no auto draw. Pass arguments to run command directly, e.g. ./run-mac.command random"
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
