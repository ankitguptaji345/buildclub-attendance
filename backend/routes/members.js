// routes/members.js
// This file handles everything about the "phonebook" of registered members.
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const config = require('../config');

// POST /api/members/register
// Called ONE TIME per member, from the Registration page.
// Saves their Build Club ID, Name, and their face "fingerprint(s)".
//
// IMPORTANT CHANGE: registration now captures the face from SEVERAL angles
// (front, left, right, up, down) instead of just one straight-on photo.
// We store all of them as an array of descriptors.
router.post('/register', async (req, res) => {
  const { buildClubId, name, adminPassword } = req.body;

  // Accept the new "descriptors" array (preferred), but still accept the
  // old single "descriptor" field.
  let descriptors = req.body.descriptors;

  if (!descriptors && req.body.descriptor) {
    descriptors = [req.body.descriptor];
  }

  if (adminPassword !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }

  if (!buildClubId || !name || !Array.isArray(descriptors) || descriptors.length === 0) {
    return res.status(400).json({
      error: 'buildClubId, name and at least one face capture are required.'
    });
  }

  try {
    await pool.query(
      `INSERT INTO members ("buildClubId", name, descriptor) VALUES ($1, $2, $3)`,
      [buildClubId, name, JSON.stringify(descriptors)]
    );

    res.json({
      success: true,
      message: `${name} registered successfully with ${descriptors.length} face angle${descriptors.length === 1 ? '' : 's'}!`
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
// Returns every registered member + their face fingerprint(s).
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, "buildClubId", name, descriptor, "createdAt" FROM members`
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
