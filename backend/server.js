const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const pool = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files FIRST
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
const attendanceRoutes = require('./routes/attendance');
const membersRoutes = require('./routes/members');
const adminRoutes = require('./routes/admin');

app.use('/api/attendance', attendanceRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/admin', adminRoutes);

// Serve HTML files (must come AFTER static middleware)
app.get('/members.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/members.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/profile.html'));
});

app.get('/reports.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/reports.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// 404 handler - serve index.html for unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🎥 Camera: http://localhost:${PORT}/camera.html`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`📋 Members: http://localhost:${PORT}/members.html`);
    console.log(`📈 Reports: http://localhost:${PORT}/reports.html`);
});

module.exports = app;
