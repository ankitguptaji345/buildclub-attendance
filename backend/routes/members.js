// routes/members.js
// This file handles everything about the "phonebook" of registered members.

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const config = require('../config');

// POST /api/members/register
// Called ONE TIME per member, from the Registration page.
// Saves their Build Club ID, Name, and their face "fingerprint" (descriptor).
// Requires the admin password so random people can't register fake faces.
router.post('/register', async (req, res) => {
  const { buildClubId, name, descriptor, adminPassword } = req.body;

  if (adminPassword !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }

  if (!buildClubId || !name || !descriptor) {
    return res.status(400).json({ error: 'buildClubId, name and descriptor are all required.' });
  }

  try {
    await pool.query(
      `INSERT INTO members ("buildClubId", name, descriptor) VALUES ($1, $2, $3)`,
      [buildClubId, name, JSON.stringify(descriptor)]
    );
    res.json({ success: true, message: `${name} registered successfully!` });
  } catch (err) {
    if (err.code === '23505') { // Postgres's "unique constraint violated" error code
      return res.status(400).json({ error: `Build Club ID "${buildClubId}" is already registered.` });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while saving the member.' });
  }
});

// GET /api/members
// Returns every registered member + their face fingerprint.
// The Live Camera page loads this once so it knows every face to compare against.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, "buildClubId", name, descriptor, "createdAt" FROM members`
  );
  const parsed = rows.map(m => ({
    ...m,
    descriptor: JSON.parse(m.descriptor) // turn the saved text back into a real array of numbers
  }));
  res.json(parsed);
});

// DELETE /api/members/:buildClubId
// Handy during testing if someone registers their face wrong and needs a redo.
router.delete('/:buildClubId', async (req, res) => {
  await pool.query(`DELETE FROM members WHERE "buildClubId" = $1`, [req.params.buildClubId]);
  res.json({ success: true });
});

module.exports = router;
