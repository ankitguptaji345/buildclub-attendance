const express = require('express');
const router = express.Router();
const pool = require('../db'); // Use your existing db connection

// Middleware: Check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const result = await pool.query('SELECT role FROM members WHERE id = $1', [userId]);
        
        if (!result.rows[0] || !['admin', 'super_admin'].includes(result.rows[0].role)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error('Admin check error:', err);
        res.status(500).json({ error: 'Authentication error: ' + err.message });
    }
};

// ============================================
// 1. GET ALL MEMBERS (with filters)
// ============================================
router.get('/members', isAdmin, async (req, res) => {
    try {
        const { role, status, search } = req.query;
        
        let query = `
            SELECT 
                id, 
                name, 
                email, 
                phone, 
                role, 
                status, 
                member_type, 
                created_at,
                (SELECT COUNT(*) FROM attendance WHERE member_id = members.id) as total_visits
            FROM members 
            WHERE 1=1
        `;
        const params = [];
        
        if (role && role !== '') {
            query += ' AND role = $' + (params.length + 1);
            params.push(role);
        }
        
        if (status && status !== '') {
            query += ' AND status = $' + (params.length + 1);
            params.push(status);
        }
        
        if (search && search !== '') {
            const searchParam = `%${search}%`;
            query += ' AND (name ILIKE $' + (params.length + 1) + ' OR email ILIKE $' + (params.length + 2) + ' OR phone ILIKE $' + (params.length + 3) + ')';
            params.push(searchParam, searchParam, searchParam);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Get members error:', err);
        res.status(500).json({ error: 'Failed to fetch members: ' + err.message });
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
            `SELECT * FROM attendance WHERE member_id = $1 ORDER BY check_in DESC LIMIT 100`,
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
                ROUND(SUM(EXTRACT(EPOCH FROM (check_out - check_in))/3600)::numeric, 2) as total_hours
            FROM attendance 
            WHERE member_id = $1 AND check_out IS NOT NULL`,
            [memberId]
        );
        
        res.json({
            member: member.rows[0],
            attendance: attendance.rows || [],
            stats: stats.rows[0] || {
                total_visits: 0,
                avg_duration_min: 0,
                total_hours: 0,
                last_visit: null
            }
        });
    } catch (err) {
        console.error('Get member profile error:', err);
        res.status(500).json({ error: 'Failed to fetch profile: ' + err.message });
    }
});

// ============================================
// 3. UPDATE MEMBER PROFILE
// ============================================
router.put('/members/:id', isAdmin, async (req, res) => {
    try {
        const { name, email, phone, role, status, member_type } = req.body;
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
        
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update member error:', err);
        res.status(500).json({ error: 'Failed to update member: ' + err.message });
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
        
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Force checkout error:', err);
        res.status(500).json({ error: 'Failed to force checkout: ' + err.message });
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
        
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        res.json({ success: true, message: 'Member deleted' });
    } catch (err) {
        console.error('Delete member error:', err);
        res.status(500).json({ error: 'Failed to delete member: ' + err.message });
    }
});

// ============================================
// 6. RESET FACE DATA
// ============================================
router.post('/members/:id/reset-face', isAdmin, async (req, res) => {
    try {
        const memberId = req.params.id;
        
        await pool.query('DELETE FROM face_data WHERE member_id = $1', [memberId]).catch(() => {});
        
        res.json({ success: true, message: 'Face data reset' });
    } catch (err) {
        console.error('Reset face error:', err);
        res.status(500).json({ error: 'Failed to reset face: ' + err.message });
    }
});

// ============================================
// 7. EXPORT MEMBER REPORT (CSV)
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
        csv += `Generated,${new Date().toLocaleString()}\n\n`;
        csv += `Name,${member.rows[0].name}\n`;
        csv += `Email,${member.rows[0].email || 'N/A'}\n`;
        csv += `Phone,${member.rows[0].phone || 'N/A'}\n`;
        csv += `Role,${member.rows[0].role}\n`;
        csv += `Status,${member.rows[0].status}\n\n`;
        
        csv += 'Attendance History\n';
        csv += 'Check-In,Check-Out,Duration (minutes)\n';
        attendance.rows.forEach(row => {
            const checkIn = new Date(row.check_in).toLocaleString();
            const checkOut = row.check_out ? new Date(row.check_out).toLocaleString() : 'Ongoing';
            csv += `"${checkIn}","${checkOut}",${row.duration_minutes || 'N/A'}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="member_${memberId}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export CSV error:', err);
        res.status(500).json({ error: 'Failed to export: ' + err.message });
    }
});

// ============================================
// 8. GET DASHBOARD ANALYTICS
// ============================================
router.get('/analytics/dashboard', isAdmin, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const totalMembers = await pool.query(
            'SELECT COUNT(*) as count FROM members WHERE status != \'deleted\''
        );
        
        const activeToday = await pool.query(
            `SELECT COUNT(DISTINCT member_id) as count FROM attendance 
             WHERE DATE(check_in) = $1`,
            [today]
        );
        
        const currentlyInside = await pool.query(
            `SELECT COUNT(DISTINCT member_id) as count FROM attendance 
             WHERE check_out IS NULL`
        );
        
        const avgStay = await pool.query(
            `SELECT ROUND(AVG(duration_minutes)::numeric, 2) as minutes FROM attendance 
             WHERE check_out IS NOT NULL`
        );
        
        res.json({
            totalMembers: parseInt(totalMembers.rows[0].count) || 0,
            activeToday: parseInt(activeToday.rows[0].count) || 0,
            currentlyInside: parseInt(currentlyInside.rows[0].count) || 0,
            avgStayMinutes: parseFloat(avgStay.rows[0].minutes) || 0
        });
    } catch (err) {
        console.error('Dashboard analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics: ' + err.message });
    }
});

// ============================================
// 9. GET HOURLY DATA
// ============================================
router.get('/analytics/hourly', isAdmin, async (req, res) => {
    try {
        const arrivals = await pool.query(
            `SELECT EXTRACT(HOUR FROM check_in)::int as hour, COUNT(*) as count 
             FROM attendance 
             WHERE check_in IS NOT NULL
             GROUP BY EXTRACT(HOUR FROM check_in)
             ORDER BY hour`
        );
        
        const departures = await pool.query(
            `SELECT EXTRACT(HOUR FROM check_out)::int as hour, COUNT(*) as count 
             FROM attendance 
             WHERE check_out IS NOT NULL
             GROUP BY EXTRACT(HOUR FROM check_out)
             ORDER BY hour`
        );
        
        res.json({ 
            arrivals: arrivals.rows || [],
            departures: departures.rows || []
        });
    } catch (err) {
        console.error('Hourly analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch hourly data: ' + err.message });
    }
});

// ============================================
// 10. GET DAILY DATA
// ============================================
router.get('/analytics/daily', isAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 14;
        
        const dailyVisits = await pool.query(
            `SELECT DATE(check_in)::text as date, COUNT(*) as visits 
             FROM attendance 
             WHERE check_in > NOW() - INTERVAL '${days} days'
             GROUP BY DATE(check_in)
             ORDER BY date DESC`
        );
        
        res.json(dailyVisits.rows || []);
    } catch (err) {
        console.error('Daily analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch daily data: ' + err.message });
    }
});

// ============================================
// 11. GET HOURS PER MEMBER
// ============================================
router.get('/analytics/hours-per-member', isAdmin, async (req, res) => {
    try {
        const hoursPerMember = await pool.query(
            `SELECT 
                m.id,
                m.name,
                COUNT(a.id) as total_visits,
                ROUND(SUM(EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600)::numeric, 2) as total_hours,
                ROUND(AVG(EXTRACT(EPOCH FROM (a.check_out - a.check_in))/60)::numeric, 2) as avg_duration_min,
                MAX(a.check_in) as last_visit
             FROM members m
             LEFT JOIN attendance a ON m.id = a.member_id AND a.check_out IS NOT NULL
             WHERE m.status != 'deleted'
             GROUP BY m.id, m.name
             ORDER BY total_hours DESC NULLS LAST`
        );
        
        res.json(hoursPerMember.rows || []);
    } catch (err) {
        console.error('Hours per member error:', err);
        res.status(500).json({ error: 'Failed to fetch hours data: ' + err.message });
    }
});

module.exports = router;
