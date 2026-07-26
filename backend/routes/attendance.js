// routes/attendance.js
// This file handles the "logbook" - checking members in, checking them out,
// and giving the dashboard the numbers it needs for charts.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function todayString() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-07-24"
}

// POST /api/attendance/mark
// Called automatically by the Live Camera page whenever it recognizes a face.
// Smart logic: if the member has no "open" session today -> this is a CHECK-IN.
//              if they already have an "open" session -> this is a CHECK-OUT.
router.post('/mark', async (req, res) => {
  const { buildClubId, name } = req.body;
  if (!buildClubId || !name) {
    return res.status(400).json({ error: 'buildClubId and name are required.' });
  }

  const today = todayString();
  const now = new Date();

  // Look for a session today that was checked in but NOT yet checked out
  const { rows } = await pool.query(
    `SELECT * FROM attendance
     WHERE "buildClubId" = $1 AND date = $2 AND "checkOut" IS NULL
     ORDER BY id DESC LIMIT 1`,
    [buildClubId, today]
  );
  const openSession = rows[0];

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
    await pool.query(
      `UPDATE attendance SET "checkOut" = $1, hours = $2 WHERE id = $3`,
      [now.toISOString(), Math.round(hours * 100) / 100, openSession.id]
    );

    return res.json({
      status: 'checked-out',
      message: `Bye ${name}! You stayed ${hours.toFixed(2)} hours today.`
    });
  } else {
    // This is a CHECK-IN: create a brand new session
    await pool.query(
      `INSERT INTO attendance ("buildClubId", name, date, "checkIn") VALUES ($1, $2, $3, $4)`,
      [buildClubId, name, today, now.toISOString()]
    );

    return res.json({
      status: 'checked-in',
      message: `Welcome ${name}! Checked in at ${now.toLocaleTimeString()}.`
    });
  }
});

// GET /api/attendance
// Returns every attendance row ever logged (newest first) - used for the dashboard table.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM attendance ORDER BY id DESC`);
  res.json(rows);
});

// GET /api/attendance/inside
// Returns everyone who is checked in RIGHT NOW (no checkout yet, today).
router.get('/inside', async (req, res) => {
  const today = todayString();
  const { rows } = await pool.query(
    `SELECT * FROM attendance WHERE date = $1 AND "checkOut" IS NULL`,
    [today]
  );
  res.json(rows);
});

// GET /api/attendance/summary
// Returns total hours, visit count, current streak, and earned badges per member.
// This is what powers the leaderboard - the streaks/badges make it feel like a real product.
router.get('/summary', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM attendance ORDER BY "checkIn" ASC`);
  const today = todayString();

  const byMember = {};
  rows.forEach(r => {
    if (!byMember[r.buildClubId]) {
      byMember[r.buildClubId] = {
        buildClubId: r.buildClubId, name: r.name,
        totalHours: 0, visits: 0, dates: new Set(),
        earlyBird: false, nightOwl: false
      };
    }
    const m = byMember[r.buildClubId];
    m.totalHours += r.hours || 0;
    m.visits += 1;
    m.dates.add(r.date);
    const hour = new Date(r.checkIn).getHours();
    if (hour < 9) m.earlyBird = true;
    if (hour >= 20) m.nightOwl = true;
  });

  function fmtDate(d) { return d.toISOString().slice(0, 10); }

  // Counts consecutive days ending today (or yesterday, if they haven't come in yet today)
  function computeStreak(datesSet) {
    let streak = 0;
    let cursor = new Date(today + 'T00:00:00');
    if (!datesSet.has(fmtDate(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (datesSet.has(fmtDate(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  let summary = Object.values(byMember).map(m => {
    const streak = computeStreak(m.dates);
    const badges = [];
    if (m.visits >= 1) badges.push({ icon: '🌱', label: 'First Visit' });
    if (streak >= 3) badges.push({ icon: '🔥', label: `${streak}-Day Streak` });
    if (m.totalHours >= 10) badges.push({ icon: '💯', label: '10-Hour Club' });
    if (m.earlyBird) badges.push({ icon: '🌅', label: 'Early Bird' });
    if (m.nightOwl) badges.push({ icon: '🦉', label: 'Night Owl' });

    return {
      buildClubId: m.buildClubId,
      name: m.name,
      totalHours: Math.round(m.totalHours * 100) / 100,
      visits: m.visits,
      streak,
      badges
    };
  });

  summary.sort((a, b) => b.totalHours - a.totalHours);
  if (summary.length > 0) summary[0].badges.unshift({ icon: '🏆', label: 'Top Maker' });

  res.json(summary);
});

// GET /api/attendance/export
// Downloads every attendance row as a CSV file - opens straight in Excel/Google Sheets.
// Great to show judges: "our data isn't locked away, it's exportable anytime."
router.get('/export', async (req, res) => {
  const { rows: logs } = await pool.query(`SELECT * FROM attendance ORDER BY date DESC, id DESC`);
  const header = 'Name,BuildClubID,Date,CheckIn,CheckOut,Hours\n';
  const rows = logs.map(r =>
    `${r.name},${r.buildClubId},${r.date},${r.checkIn},${r.checkOut || ''},${r.hours ?? ''}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="buildclub_attendance.csv"');
  res.send(header + rows);
});

// GET /api/attendance/heatmap
// Returns total hours logged per day - used to draw the GitHub-style activity calendar
// on the dashboard (a nice "wow" visual for judges).
router.get('/heatmap', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT date, COALESCE(SUM(hours), 0) as "totalHours", COUNT(*) as visits
    FROM attendance
    GROUP BY date
    ORDER BY date ASC
  `);
  // We convert the numbers explicitly here because Postgres sometimes sends
  // them back as text - this keeps the dashboard chart working correctly.
  const data = rows.map(r => ({
    date: r.date,
    totalHours: Math.round(Number(r.totalHours) * 100) / 100,
    visits: Number(r.visits)
  }));
  res.json(data);
});

// Safety net: if someone forgot to check out (walked out a side door, camera
// missed them, laptop closed, etc.) this closes their session automatically
// after a long time so their "hours" don't grow forever. Call this on a timer.
const STALE_HOURS = 12;
async function autoCloseStaleSessions() {
  const cutoffISO = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
  const { rows: stale } = await pool.query(
    `SELECT * FROM attendance WHERE "checkOut" IS NULL AND "checkIn" < $1`,
    [cutoffISO]
  );

  for (const s of stale) {
    const checkInTime = new Date(s.checkIn);
    const checkOutTime = new Date(checkInTime.getTime() + STALE_HOURS * 60 * 60 * 1000);
    await pool.query(
      `UPDATE attendance SET "checkOut" = $1, hours = $2 WHERE id = $3`,
      [checkOutTime.toISOString(), STALE_HOURS, s.id]
    );
    console.log(`⏰ Auto-checked-out ${s.name} (forgot to check out - capped at ${STALE_HOURS}h).`);
  }
}
router.autoCloseStaleSessions = autoCloseStaleSessions;

module.exports = router;
