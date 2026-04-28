@echo off
setlocal
cd /d "%~dp0"

set PORT=5173
echo Starting local server (Node) on http://127.0.0.1:%PORT% ...
echo.

where node >nul 2>nul
if not %ERRORLEVEL%==0 (
  echo Node.js not found.
  echo Please install Node.js, then re-run this script.
  pause
  goto :eof
)

start "" "http://127.0.0.1:%PORT%/index.html"
node server.js %PORT%
