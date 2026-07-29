require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDb } = require('./db');

const membersRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/members', membersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

async function start() {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log('====================================================');
      console.log('✅ Build Club Attendance server is running!');
      console.log(`👉 Open this in your browser: http://localhost:${PORT}`);
      console.log('====================================================');
    });

    attendanceRoutes.autoCloseStaleSessions().catch(err => {
      console.error('Auto-checkout check failed:', err);
    });

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

start();
