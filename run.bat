@echo off
setlocal

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not installed or not on PATH.
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting SAR PoD Calculator at http://localhost:4173 ...

REM Kill anything already listening on 4173 (prevents old server issue)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":4173 .*LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

REM Start the server first
start "" /B cmd /c "npm run start"

REM Give it a second to start
timeout /t 1 /nobreak >nul

REM Then open the browser (cache-bust URL)
start "" "http://localhost:4173/?v=%RANDOM%%RANDOM%"

endlocal
