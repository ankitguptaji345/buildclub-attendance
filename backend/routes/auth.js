// routes/auth.js
// A tiny route just for checking the admin password.
// This is what "unlocks" the Register page in the browser.

const express = require('express');
const router = express.Router();
const config = require('../config');

// POST /api/auth/check
// Body: { password: "..." }
// Returns { ok: true } if it matches, { ok: false } if not.
router.post('/check', (req, res) => {
  const { password } = req.body;
  const ok = password === config.ADMIN_PASSWORD;
  res.json({ ok });
});

module.exports = router;
