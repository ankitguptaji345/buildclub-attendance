const express = require('express');
const router = express.Router();
const pool = require('../db'); // FIXED: Changed from '../config/db' to '../db'
const fs = require('fs');
const path = require('path');

// Middleware: Check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const result = await pool.query('SELECT role FROM members WHERE id = $1', [userId]);
        
        if (!result.rows[0] || !['admin', 'super_admin'].includes(result.rows[0].role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// 1. GET ALL MEMBERS (with filters)
// ============================================
router.get('/members', isAdmin, async (req, res) => {
    try {
        const { role, status, search } = req.query;
        
        let query = 'SELECT id, name, email, phone, role, status, member_type, created_at, (SELECT COUNT(*) FROM attendance WHERE member_id = members.id) as total_visits FROM members WHERE 1=1';
        const params = [];
        
        if (role) {
            query += ' AND role = $' + (params.length + 1);
            params.push(role);
        }
        if (status) {
            query += ' AND status = $' + (params.length + 1);
            params.push(status);
        }
        if (search) {
            query += ' AND (name ILIKE $' + (params.length + 1) + ' OR email ILIKE $' + (params.length + 1) + ' OR phone ILIKE $' + (params.length + 1) + ')';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 2. GET SINGLE MEMBER PROFILE
// ============================================
router.get('/members/:id', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        const member = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
        
        if (!member.rows.length) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        // Get attendance history
        const attendance = await pool.query(
            `SELECT * FROM attendance WHERE member_id = $1 ORDER BY check_in DESC`,
            [memberId]
        );
        
        // Calculate stats
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_visits,
                ROUND(AVG(EXTRACT(EPOCH FROM (check_out - check_in))/60)::numeric, 2) as avg_duration_min,
                MAX(EXTRACT(EPOCH FROM (check_out - check_in))/60) as longest_duration_min,
                MIN(EXTRACT(EPOCH FROM (check_out - check_in))/60) as shortest_duration_min,
                MAX(check_in) as last_visit,
                SUM(EXTRACT(EPOCH FROM (check_out - check_in))/3600) as total_hours
            FROM attendance 
            WHERE member_id = $1 AND check_out IS NOT NULL`,
            [memberId]
        );
        
        res.json({
            member: member.rows[0],
            attendance: attendance.rows,
            stats: stats.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 3. UPDATE MEMBER PROFILE
// ============================================
router.put('/members/:id', isAdmin, async (req, res) => {
    try {
        const { name, email, phone, role, status, member_type, department } = req.body;
        const memberId = req.params.id;
        
        const result = await pool.query(
            `UPDATE members 
             SET name = COALESCE($1, name), 
                 email = COALESCE($2, email), 
                 phone = COALESCE($3, phone), 
                 role = COALESCE($4, role), 
                 status = COALESCE($5, status), 
                 member_type = COALESCE($6, member_type)
             WHERE id = $7
             RETURNING *`,
            [name, email, phone, role, status, member_type, memberId]
        );
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id, details) 
             VALUES ($1, $2, $3, $4)`,
            [req.session.userId, 'UPDATE_MEMBER', memberId, JSON.stringify(req.body)]
        ).catch(() => {}); // Ignore if table doesn't exist
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 4. FORCE CHECKOUT
// ============================================
router.post('/members/:id/force-checkout', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        const checkOutTime = new Date();
        
        // Find open check-in
        const openSession = await pool.query(
            `SELECT id, check_in FROM attendance 
             WHERE member_id = $1 AND check_out IS NULL
             ORDER BY check_in DESC LIMIT 1`,
            [memberId]
        );
        
        if (!openSession.rows.length) {
            return res.status(400).json({ error: 'No active session found' });
        }
        
        const sessionId = openSession.rows[0].id;
        const checkInTime = new Date(openSession.rows[0].check_in);
        const durationMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
        
        // Update attendance
        const result = await pool.query(
            `UPDATE attendance 
             SET check_out = $1, duration_minutes = $2
             WHERE id = $3
             RETURNING *`,
            [checkOutTime, durationMinutes, sessionId]
        );
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id, details) 
             VALUES ($1, $2, $3, $4)`,
            [req.session.userId, 'FORCE_CHECKOUT', memberId, JSON.stringify({ sessionId, duration: durationMinutes })]
        ).catch(() => {});
        
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 5. DELETE MEMBER (ADMIN ONLY)
// ============================================
router.delete('/members/:id', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        // Soft delete - just change status
        const result = await pool.query(
            `UPDATE members SET status = 'deleted' WHERE id = $1 RETURNING *`,
            [memberId]
        );
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id, details) 
             VALUES ($1, $2, $3, $4)`,
            [req.session.userId, 'DELETE_MEMBER', memberId, JSON.stringify({ deleted_at: new Date() })]
        ).catch(() => {});
        
        res.json({ success: true, message: 'Member deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 6. RESET FACE DATA
// ============================================
router.post('/members/:id/reset-face', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        await pool.query('DELETE FROM face_data WHERE member_id = $1', [memberId]).catch(() => {});
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id) 
             VALUES ($1, $2, $3)`,
            [req.session.userId, 'RESET_FACE', memberId]
        ).catch(() => {});
        
        res.json({ success: true, message: 'Face data reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 7. MANUAL ATTENDANCE ENTRY
// ============================================
router.post('/members/:id/manual-attendance', isAdmin, async (req, res) => {
    try {
        const { check_in, check_out } = req.body;
        const memberId = req.params.id;
        
        const checkInTime = new Date(check_in);
        const checkOutTime = new Date(check_out);
        const durationMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
        
        const result = await pool.query(
            `INSERT INTO attendance (member_id, check_in, check_out, duration_minutes) 
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [memberId, checkInTime, checkOutTime, durationMinutes]
        );
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id, details) 
             VALUES ($1, $2, $3, $4)`,
            [req.session.userId, 'MANUAL_ATTENDANCE', memberId, JSON.stringify({ check_in, check_out })]
        ).catch(() => {});
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 8. DELETE ATTENDANCE RECORD
// ============================================
router.delete('/attendance/:id', isAdmin, async (req, res) => {
    try {
        const attendanceId = req.params.id;
        
        const attendance = await pool.query('SELECT member_id FROM attendance WHERE id = $1', [attendanceId]);
        
        await pool.query('DELETE FROM attendance WHERE id = $1', [attendanceId]);
        
        // Log admin action
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, target_member_id, details) 
             VALUES ($1, $2, $3, $4)`,
            [req.session.userId, 'DELETE_ATTENDANCE', attendance.rows[0].member_id, JSON.stringify({ attendanceId })]
        ).catch(() => {});
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 9. EXPORT MEMBER REPORT (CSV)
// ============================================
router.get('/members/:id/export/csv', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        const member = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
        
        if (!member.rows.length) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        const attendance = await pool.query(
            `SELECT check_in, check_out, duration_minutes FROM attendance 
             WHERE member_id = $1 ORDER BY check_in DESC`,
            [memberId]
        );
        
        let csv = 'Member Attendance Report\n';
        csv += `Name,${member.rows[0].name}\n`;
        csv += `Email,${member.rows[0].email}\n`;
        csv += `Phone,${member.rows[0].phone || 'N/A'}\n`;
        csv += `Role,${member.rows[0].role}\n\n`;
        
        csv += 'Check-In,Check-Out,Duration (minutes)\n';
        attendance.rows.forEach(row => {
            csv += `${new Date(row.check_in).toLocaleString()},${row.check_out ? new Date(row.check_out).toLocaleString() : 'Ongoing'},${row.duration_minutes || 'N/A'}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="member_${memberId}_report.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 10. EXPORT MEMBER REPORT (JSON for PDF)
// ============================================
router.get('/members/:id/export/pdf', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        const member = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
        const attendance = await pool.query(
            `SELECT check_in, check_out, duration_minutes FROM attendance 
             WHERE member_id = $1 ORDER BY check_in DESC`,
            [memberId]
        );
        
        const stats = await pool.query(
            `SELECT 
                COUNT(*) as total_visits,
                ROUND(AVG(EXTRACT(EPOCH FROM (check_out - check_in))/60)::numeric, 2) as avg_duration_min,
                SUM(EXTRACT(EPOCH FROM (check_out - check_in))/3600) as total_hours
            FROM attendance 
            WHERE member_id = $1 AND check_out IS NOT NULL`,
            [memberId]
        );
        
        // Return data as JSON - frontend will handle PDF generation with jsPDF
        res.json({
            member: member.rows[0],
            attendance: attendance.rows,
            stats: stats.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 11. GET DASHBOARD ANALYTICS
// ============================================
router.get('/analytics/dashboard', isAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Total members
        const totalMembers = await pool.query('SELECT COUNT(*) FROM members WHERE status != \'deleted\'');
        
        // Active today
        const activeToday = await pool.query(
            `SELECT COUNT(DISTINCT member_id) as count FROM attendance 
             WHERE DATE(check_in) = $1`,
            [today]
        );
        
        // Currently inside
        const currentlyInside = await pool.query(
            `SELECT COUNT(DISTINCT member_id) as count FROM attendance 
             WHERE check_out IS NULL`
        );
        
        // Average stay
        const avgStay = await pool.query(
            `SELECT ROUND(AVG(duration_minutes)::numeric, 2) as minutes FROM attendance 
             WHERE check_out IS NOT NULL`
        );
        
        res.json({
            totalMembers: totalMembers.rows[0].count,
            activeToday: activeToday.rows[0].count,
            currentlyInside: currentlyInside.rows[0].count,
            avgStayMinutes: avgStay.rows[0].minutes || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 12. GET HOURLY ARRIVAL/DEPARTURE DATA
// ============================================
router.get('/analytics/hourly', isAdmin, async (req, res) => {
    try {
        const arrivals = await pool.query(
            `SELECT EXTRACT(HOUR FROM check_in) as hour, COUNT(*) as count 
             FROM attendance 
             WHERE check_in IS NOT NULL
             GROUP BY EXTRACT(HOUR FROM check_in)
             ORDER BY hour`
        );
        
        const departures = await pool.query(
            `SELECT EXTRACT(HOUR FROM check_out) as hour, COUNT(*) as count 
             FROM attendance 
             WHERE check_out IS NOT NULL
             GROUP BY EXTRACT(HOUR FROM check_out)
             ORDER BY hour`
        );
        
        res.json({ 
            arrivals: arrivals.rows.map(r => ({ hour: parseInt(r.hour) || 0, count: parseInt(r.count) })),
            departures: departures.rows.map(r => ({ hour: parseInt(r.hour) || 0, count: parseInt(r.count) }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 13. GET DAILY VISITS DATA
// ============================================
router.get('/analytics/daily', isAdmin, async (req, res) => {
    try {
        const { days = 14 } = req.query;
        
        const dailyVisits = await pool.query(
            `SELECT DATE(check_in) as date, COUNT(*) as visits 
             FROM attendance 
             WHERE check_in > NOW() - INTERVAL '${parseInt(days)} days'
             GROUP BY DATE(check_in)
             ORDER BY date DESC`
        );
        
        res.json(dailyVisits.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 14. TOTAL HOURS PER MEMBER
// ============================================
router.get('/analytics/hours-per-member', isAdmin, async (req, res) => {
    try {
        const hoursPerMember = await pool.query(
            `SELECT 
                m.id,
                m.name,
                COUNT(*) as total_visits,
                ROUND(SUM(EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600)::numeric, 2) as total_hours,
                ROUND(AVG(EXTRACT(EPOCH FROM (a.check_out - a.check_in))/60)::numeric, 2) as avg_duration_min,
                MAX(a.check_in) as last_visit
             FROM members m
             LEFT JOIN attendance a ON m.id = a.member_id AND a.check_out IS NOT NULL
             WHERE m.status != 'deleted'
             GROUP BY m.id, m.name
             ORDER BY total_hours DESC NULLS LAST`
        );
        
        res.json(hoursPerMember.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
