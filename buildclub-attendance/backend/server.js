// server.js
// This is the "brain" of the whole project. It starts a small web server that:
//  1) Serves the frontend website (the HTML/CSS/JS pages)
//  2) Answers API requests (save a member, mark attendance, get charts data)

const express = require('express');
const cors = require('cors');
const path = require('path');

const membersRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // face fingerprints are longish arrays of numbers

// Serve the whole "frontend" folder as a plain website
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Anything starting with /api/members or /api/attendance goes to our route files
app.use('/api/members', membersRoutes);
app.use('/api/attendance', attendanceRoutes);

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`✅ Build Club Attendance server is running!`);
  console.log(`👉 Open this in your browser: http://localhost:${PORT}`);
  console.log('====================================================');
});
