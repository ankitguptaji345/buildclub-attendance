@echo off
REM start.bat -- double-click this file to launch the whole app.
REM It installs dependencies the first time only, starts the server,
REM and automatically opens your browser. No manual commands needed.

cd /d "%~dp0backend"

if not exist node_modules (
  echo First time setup - installing dependencies ^(only happens once^)...
  call npm install
)

echo Starting Build Club Attendance server...
start "" http://localhost:3000
call npm start
