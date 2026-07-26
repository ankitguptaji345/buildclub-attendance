#!/bin/bash
# start.sh — double-click (or run) this file to launch the whole app.
# It installs dependencies the first time only, starts the server,
# and automatically opens your browser. No manual commands needed.

cd "$(dirname "$0")/backend" || exit 1

if [ ! -d "node_modules" ]; then
  echo "First time setup - installing dependencies (only happens once)..."
  npm install
fi

echo "Starting Build Club Attendance server..."
( sleep 2
  if command -v open >/dev/null 2>&1; then
    open http://localhost:3000        # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000    # Linux
  fi
) &

npm start
