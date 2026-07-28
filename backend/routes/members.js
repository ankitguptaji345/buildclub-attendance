// routes/members.js
// This file handles everything about the "phonebook" of registered members.
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const config = require('../config');

// The four roles the register page can create. Anything else sent by the
// client gets quietly treated as 'member' instead of trusted blindly.
const ALLOWED_ROLES = ['admin', 'mentor', 'member', 'guest'];

// POST /api/members/register
// Called ONE TIME per member, from the Registration page.
// Saves their Build Club ID, Name, role, and their face "fingerprint(s)".
//
// Multi-angle capture: registration captures the face from SEVERAL angles
// (front, left, right, up, down) instead of just one straight-on photo.
// We store all of them as an array of descriptors.
//
// Role + password rule: registering someone as admin, mentor, or member
// changes who the system trusts, so it requires the team admin password.
// Guests are lower-stakes (visitors, one-off demo attendees) so they can
// register themselves without needing that password.
router.post('/register', async (req, res) => {
  const { buildClubId, name, adminPassword } = req.body;

  let role = (req.body.role || 'member').toString().toLowerCase();
  if (!ALLOWED_ROLES.includes(role)) role = 'member';

  // Accept the new "descriptors" array (preferred), but still accept the
  // old single "descriptor" field.
  let descriptors = req.body.descriptors;

  if (!descriptors && req.body.descriptor) {
    descriptors = [req.body.descriptor];
  }

  if (role !== 'guest' && adminPassword !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }

  if (!buildClubId || !name || !Array.isArray(descriptors) || descriptors.length === 0) {
    return res.status(400).json({
      error: 'buildClubId, name and at least one face capture are required.'
    });
  }

  try {
    await pool.query(
      `INSERT INTO members ("buildClubId", name, role, descriptor) VALUES ($1, $2, $3, $4)`,
      [buildClubId, name, role, JSON.stringify(descriptors)]
    );

    res.json({
      success: true,
      message: `${name} registered successfully as ${role} with ${descriptors.length} face angle${descriptors.length === 1 ? '' : 's'}!`
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        error: `Build Club ID "${buildClubId}" is already registered.`
      });
    }

    console.error(err);
    res.status(500).json({
      error: 'Something went wrong while saving the member.'
    });
  }
});

// GET /api/members
// Returns every registered member (with role) + their face fingerprint(s).
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, "buildClubId", name, role, descriptor, "createdAt" FROM members`
  );

  const parsed = rows.map(m => {
    const raw = JSON.parse(m.descriptor);

    // Normalize old single descriptors and new multi-angle descriptors.
    const descriptors = Array.isArray(raw[0]) ? raw : [raw];

    const { descriptor, ...rest } = m;

    return { ...rest, descriptors };
  });

  res.json(parsed);
});

// DELETE /api/members/:buildClubId
// Handy during testing if someone registers their face wrong and needs a redo.
router.delete('/:buildClubId', async (req, res) => {
  await pool.query(
    `DELETE FROM members WHERE "buildClubId" = $1`,
    [req.params.buildClubId]
  );

  res.json({ success: true });
});

module.exports = router;
