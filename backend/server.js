// server.js
// This is the "brain" of the whole project. It starts a small web server that:
//  1) Serves the frontend website (the HTML/CSS/JS pages)
//  2) Answers API requests (save a member, mark attendance, get charts data)
//  3) Handles admin API requests

require('dotenv').config(); // loads backend/.env when running on your own computer

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db');

const membersRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

// IMPORTANT CHANGE:
// This used to be hard-coded to 3000.
// Free hosts like Render assign their own port number through an environment
// variable and expect your app to listen on THAT port.
// On your own computer, if no PORT variable is set, it falls back to 3000.
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
// Face fingerprints are longish arrays of numbers, so we allow up to 15 MB.
app.use(express.json({ limit: '15mb' }));

// Serve the whole "frontend" folder as a plain website
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================================
// API ROUTES
// ============================================================

// Member-related API routes
app.use('/api/members', membersRoutes);

// Attendance-related API routes
app.use('/api/attendance', attendanceRoutes);

// Authentication-related API routes
app.use('/api/auth', authRoutes);

// Admin-related API routes
app.use('/api/admin', adminRoutes);


// ============================================================
// START SERVER
// ============================================================

async function start() {
  try {
    // Make sure the database tables exist before accepting traffic.
    await initDb();

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log('✅ Build Club Attendance server is running!');
      console.log(`👉 Open this in your browser: http://localhost:${PORT}`);
      console.log('====================================================');
    });

    // ============================================================
    // AUTO-CLOSE STALE ATTENDANCE SESSIONS
    // ============================================================

    // Safety net:
    // Automatically close any attendance session someone forgot
    // to check out of.

    // Runs once at startup
    attendanceRoutes.autoCloseStaleSessions().catch(err => {
      console.error('Auto-checkout check failed:', err);
    });

    // Then runs every 15 minutes
    setInterval(() => {
      attendanceRoutes.autoCloseStaleSessions().catch(err => {
        console.error('Auto-checkout check failed:', err);
      });
    }, 15 * 60 * 1000);

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start the application
start();
