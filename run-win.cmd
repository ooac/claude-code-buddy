@echo off
setlocal

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

chcp 65001 >nul 2>&1
if errorlevel 1 set "BUDDY_FORCE_ASCII=1"
for /f "tokens=2 delims=: " %%A in ('chcp') do set "CODEPAGE=%%A"
if not "%CODEPAGE%"=="65001" set "BUDDY_FORCE_ASCII=1"

set "NODE_EXE=node"
if exist "%ROOT_DIR%runtime\node.exe" set "NODE_EXE=%ROOT_DIR%runtime\node.exe"
set "CLI_JS=%ROOT_DIR%dist\cli.js"
if exist "%ROOT_DIR%app\dist\cli.js" set "CLI_JS=%ROOT_DIR%app\dist\cli.js"

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
