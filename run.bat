@echo off
setlocal

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not installed or not on PATH.
  echo Install Node.js LTS from https://nodejs.org and try again.
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
)

echo Starting SAR PoD Calculator at http://localhost:4173 ...
start http://localhost:4173
call npm run start

endlocal
