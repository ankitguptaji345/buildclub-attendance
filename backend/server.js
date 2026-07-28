// server.js
// This is the "brain" of the whole project. It starts a small web server that:
//  1) Serves the frontend website (the HTML/CSS/JS pages)
//  2) Answers API requests (save a member, mark attendance, get charts data)

require('dotenv').config(); // loads backend/.env when running on your own computer

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db');
const membersRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/auth');

const app = express();

// IMPORTANT CHANGE: this used to be hard-coded to 3000. Free hosts like
// Render assign their own port number through an environment variable and
// expect your app to listen on THAT port - if you ignore it and always use
// 3000, the site never comes online. On your own computer, no PORT variable
// is set, so it falls back to 3000 exactly like before.
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // face fingerprints are longish arrays of numbers

// Serve the whole "frontend" folder as a plain website
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Anything starting with /api/members or /api/attendance goes to our route files
app.use('/api/members', membersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);

async function start() {
  // Make sure our two database tables exist before we accept any traffic.
  await initDb();

  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`✅ Build Club Attendance server is running!`);
    console.log(`👉 Open this in your browser: http://localhost:${PORT}`);
    console.log('====================================================');
  });

  // Safety net: auto-close any attendance session someone forgot to check out of.
  // Runs once at startup, then every 15 minutes.
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
