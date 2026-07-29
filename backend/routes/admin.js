// routes/admin.js
// Admin-only actions that are dangerous or sensitive enough to require the
// team admin password on every request (sent as the 'x-admin-password' header).
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const config = require('../config');

// Middleware: Check the request carries the correct admin password.
const isAdmin = (req, res, next) => {
    const suppliedPassword = req.headers['x-admin-password'];

    if (!suppliedPassword || suppliedPassword !== config.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// POST /api/admin/reset
// Wipes EVERY member and EVERY attendance record - the whole system starts
// again from zero. This cannot be undone, so it requires the admin password.
router.post('/reset', isAdmin, async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE attendance');
        await pool.query('TRUNCATE TABLE members');

        res.json({
            success: true,
            message: 'System reset. All members and attendance records were deleted.'
        });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ error: 'Failed to reset: ' + err.message });
    }
});

module.exports = router;
