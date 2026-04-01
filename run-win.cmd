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
set /p ANSWER=Input q to exit, press Enter to draw again: 
if /I "%ANSWER%"=="q" goto finish
if /I "%ANSWER%"=="quit" goto finish
if /I "%ANSWER%"=="exit" goto finish

echo.
"%NODE_EXE%" "%CLI_JS%" random
echo.
"%NODE_EXE%" "%CLI_JS%" card
goto loop

:run_args
"%NODE_EXE%" "%CLI_JS%" %*

:finish
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit %EXIT_CODE%
