// server.js — Build Club Attendance backend entry point

// Load backend/.env explicitly so it works whether the server was started
// from the project root (Render) or from backend/ (local `npm start`).
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db');
const membersRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API routes
app.use('/api/members', membersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);

// Health-check — the frontend pings this on load so Render's free-tier
// server starts waking up BEFORE the user clicks anything.
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

async function start() {
  await initDb();

  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`✅ Build Club Attendance server running on port ${PORT}`);
    console.log('====================================================');
  });

  // Safety net: auto-close forgotten sessions on startup + every 15 min
  attendanceRoutes.autoCloseStaleSessions().catch(err =>
    console.error('Auto-checkout check failed:', err)
  );
  setInterval(() => {
    attendanceRoutes.autoCloseStaleSessions().catch(err =>
      console.error('Auto-checkout check failed:', err)
    );
  }, 15 * 60 * 1000);
}

start().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
