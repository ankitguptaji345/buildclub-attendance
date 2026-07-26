# Build Club Vision Challenge — Smart Attendance System

A face-recognition attendance system for the makerspace. Register a member's
face once, then a live webcam automatically checks members in and out and
tracks their hours on a dashboard.

## Folder structure

```
buildclub-attendance/
├── backend/          <- Member B: server, database, face-matching logic
│   ├── server.js
│   ├── db.js
│   ├── package.json
│   └── routes/
│       ├── members.js
│       └── attendance.js
└── frontend/         <- Member A: pages the user sees
    ├── index.html
    ├── register.html
    ├── camera.html
    ├── dashboard.html
    ├── css/style.css
    ├── js/ (register.js, camera.js, dashboard.js)
    ├── lib/ (face-api.min.js, chart.umd.js)
    └── models/ (face recognition model weights)
```

## How to run (one click)

- **Windows:** double-click `start.bat`
- **Mac/Linux:** double-click `start.sh` (or run `./start.sh` in a terminal)

Either script installs dependencies the first time only, starts the server,
and opens your browser automatically. No manual commands after that.

First time only, on Mac/Linux you may need to run `chmod +x start.sh` once.

## What's new in this version

- 🔒 Admin password required to register a new face (change it in `backend/config.js`)
- 🏅 Leaderboard with medals + earned badges (🌱 First Visit, 🔥 Streaks, 💯 10-Hour Club, 🌅 Early Bird, 🦉 Night Owl, 🏆 Top Maker)
- 🔥 Daily streak tracking (consecutive days visited)
- 🔥 GitHub-style activity heatmap calendar
- 🔔 Live toast pop-ups + sound when someone checks in/out (with a mute toggle)
- 🎯 Confidence % shown on every recognized face
- ⏰ Auto-checkout safety net (closes forgotten sessions after 12 hours automatically)
- 🔍 Search box on the attendance log table
- 🖥️ One-click "Kiosk Mode" fullscreen button + live clock banner on the camera page
- ⬇️ One-click CSV export of all attendance data
- 🖱️ One-click start scripts (`start.bat` / `start.sh`) — no manual `npm start`
- ⚙️ Optional `ecosystem.config.js` to run permanently in the background with PM2

Full step-by-step setup, GitHub workflow, and deployment options are in the
PDF and chat where this project was generated.
