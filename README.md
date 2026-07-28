# Build Club Vision Challenge — Smart Attendance System

A face-recognition attendance system for the makerspace. Register a member's
face once, then a live webcam automatically checks members in and out and
tracks their hours on a dashboard.

## Folder structure

```
buildclub-attendance/
├── backend/          <- server, database, face-matching logic
│   ├── server.js
│   ├── db.js
│   ├── config.js
│   ├── package.json
│   └── routes/
│       ├── members.js
│       ├── attendance.js
│       └── auth.js
└── frontend/         <- pages the user sees
    ├── index.html
    ├── register.html
    ├── camera.html
    ├── dashboard.html
    ├── css/style.css
    ├── js/ (register.js, camera.js, dashboard.js, home.js, toast.js)
    ├── lib/ (face-api.min.js, chart.umd.js)
    └── models/ (face recognition model weights)
```

## Roles

Every member is registered under one of four roles:

| Role   | Needs admin password to register? |
|--------|------------------------------------|
| Admin  | Yes |
| Mentor | Yes |
| Member | Yes |
| Guest  | No — guests can self-register |

The dashboard shows a combined leaderboard for everyone, plus separate
sections and a filter for each role.

## How to run locally

1. `cd backend && npm install`
2. Copy `backend/.env.example` to `backend/.env` and fill in your own
   `DATABASE_URL` (from Neon) and `ADMIN_PASSWORD`.
3. `npm start` (or `npm run dev` for auto-reload)
4. Open `http://localhost:3000`

Or just double-click `start.bat` (Windows) / run `./start.sh` (Mac/Linux) —
either script installs dependencies the first time only, starts the server,
and opens your browser automatically.

## Deploying on Render

The backend serves the whole frontend too, so you only need **one** Render
web service (not a separate one for the frontend).

1. Push this repo to GitHub (your `.env` file is git-ignored on purpose —
   never commit it, since it holds your database and admin password).
2. On Render: **New → Web Service** → connect this repo.
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
3. Go to your new service → **Environment** tab → add:
   - `DATABASE_URL` — your Neon Postgres connection string
   - `ADMIN_PASSWORD` — your chosen admin password
   (You do **not** need to set `PORT` — Render sets that automatically.)
4. Save. Render will redeploy automatically. Give it a minute, then open
   the service URL.

**If register/camera/dashboard ever stop working again on Render**, the
Environment tab above is the first place to check — if either variable is
missing or wrong, every database-backed feature (register, dashboard,
recognition, admin password) fails at once, since they all depend on it.

## What's new in this version

- 🧩 **Role-based registration** — Admin / Mentor / Member / Guest. Guests
  skip the admin password; everyone else needs it.
- 🎯 **Auto-capture registration** — turn your head through each of the 5
  poses and it captures itself the moment you hold it steady; no button
  mashing required (a manual capture button is still there as a fallback).
- 🏅 Leaderboard with medals + earned badges (🌱 First Visit, 🔥 Streaks,
  💯 10-Hour Club, 🌅 Early Bird, 🦉 Night Owl, 🏆 Top Maker), now split by
  role as well as combined.
- 🔥 Daily streak tracking, GitHub-style activity heatmap.
- 🔔 Live toast pop-ups + sound on check-in/out, with a mute toggle.
- 🎯 Confidence % and role shown on every recognized face.
- ⏰ Auto-checkout safety net (closes forgotten sessions after 12 hours).
- 🔍 Role filter tabs + search box on the attendance log.
- 🖥️ Kiosk Mode fullscreen button + live clock on the camera page.
- ⬇️ One-click CSV export.
