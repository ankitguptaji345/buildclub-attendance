// routes/attendance.js
// This file handles the "logbook" - checking members in, checking them out,
// and giving the dashboard the numbers it needs for charts.

const express = require('express');
const router = express.Router();
const db = require('../db');

function todayString() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-07-24"
}

// POST /api/attendance/mark
// Called automatically by the Live Camera page whenever it recognizes a face.
// Smart logic: if the member has no "open" session today -> this is a CHECK-IN.
//              if they already have an "open" session -> this is a CHECK-OUT.
router.post('/mark', (req, res) => {
  const { buildClubId, name } = req.body;
  if (!buildClubId || !name) {
    return res.status(400).json({ error: 'buildClubId and name are required.' });
  }

  const today = todayString();
  const now = new Date();

  // Look for a session today that was checked in but NOT yet checked out
  const openSession = db.prepare(`
    SELECT * FROM attendance
    WHERE buildClubId = ? AND date = ? AND checkOut IS NULL
    ORDER BY id DESC LIMIT 1
  `).get(buildClubId, today);

  if (openSession) {
    // Don't let the camera "check someone out" 2 seconds after checking them in
    // (this happens if the camera scans the same face many times in a row)
    const checkInTime = new Date(openSession.checkIn);
    const secondsSinceCheckIn = (now - checkInTime) / 1000;
    if (secondsSinceCheckIn < 20) {
      return res.json({ status: 'already-checked-in', message: `${name} is already checked in.` });
    }

    // This is a CHECK-OUT: close the session and calculate hours spent
    const hours = (now - checkInTime) / (1000 * 60 * 60);
    db.prepare(`UPDATE attendance SET checkOut = ?, hours = ? WHERE id = ?`)
      .run(now.toISOString(), Math.round(hours * 100) / 100, openSession.id);

    return res.json({
      status: 'checked-out',
      message: `Bye ${name}! You stayed ${hours.toFixed(2)} hours today.`
    });
  } else {
    // This is a CHECK-IN: create a brand new session
    db.prepare(`INSERT INTO attendance (buildClubId, name, date, checkIn) VALUES (?, ?, ?, ?)`)
      .run(buildClubId, name, today, now.toISOString());

    return res.json({
      status: 'checked-in',
      message: `Welcome ${name}! Checked in at ${now.toLocaleTimeString()}.`
    });
  }
});

// GET /api/attendance
// Returns every attendance row ever logged (newest first) - used for the dashboard table.
router.get('/', (req, res) => {
  const logs = db.prepare('SELECT * FROM attendance ORDER BY id DESC').all();
  res.json(logs);
});

// GET /api/attendance/inside
// Returns everyone who is checked in RIGHT NOW (no checkout yet, today).
router.get('/inside', (req, res) => {
  const today = todayString();
  const inside = db.prepare(`SELECT * FROM attendance WHERE date = ? AND checkOut IS NULL`).all(today);
  res.json(inside);
});

// GET /api/attendance/summary
// Returns total hours + visit count per member - used for the bar chart & leaderboard.
router.get('/summary', (req, res) => {
  const summary = db.prepare(`
    SELECT buildClubId, name,
           ROUND(SUM(COALESCE(hours, 0)), 2) as totalHours,
           COUNT(*) as visits
    FROM attendance
    GROUP BY buildClubId, name
    ORDER BY totalHours DESC
  `).all();
  res.json(summary);
});

module.exports = router;
