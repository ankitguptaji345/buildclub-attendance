const express = require('express');
const router = express.Router();

const config = require('../config');

router.post('/check', (req, res) => {
  const { password } = req.body;

  const ok = password === config.ADMIN_PASSWORD;

  res.json({ ok });
});

module.exports = router;
