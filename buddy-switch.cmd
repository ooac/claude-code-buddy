@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "NODE_EXE=node"
if exist "%ROOT_DIR%runtime\node.exe" set "NODE_EXE=%ROOT_DIR%runtime\node.exe"
set "CLI_JS=%ROOT_DIR%dist\cli.js"
if exist "%ROOT_DIR%app\dist\cli.js" set "CLI_JS=%ROOT_DIR%app\dist\cli.js"

chcp 65001 >nul 2>&1
if errorlevel 1 set "BUDDY_FORCE_ASCII=1"
for /f "tokens=2 delims=: " %%A in ('chcp') do set "CODEPAGE=%%A"
if not "%CODEPAGE%"=="65001" set "BUDDY_FORCE_ASCII=1"

"%NODE_EXE%" "%CLI_JS%" %*
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
