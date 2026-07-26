// db.js
// This file connects to our database.
//
// IMPORTANT CHANGE: this used to save everything into one local file
// (attendance.db) using SQLite. That worked great on your own laptop, but
// free hosting like Render does NOT keep local files - they get wiped every
// time the site restarts or goes to sleep. So we now use Postgres, a real
// cloud database (we're using a free one from neon.tech). The data now lives
// on the internet, not on the server's disk, so it survives restarts,
// redeploys, and the free-tier "sleep" that happens after 15 minutes of
// no visitors.
//
// You don't need to install any database software - Neon hosts it for you,
// for free. You just need one secret connection string, saved as
// DATABASE_URL (see .env.example).

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Neon requires a secure connection
});

// Creates our two tables the first time the app ever starts.
// If they already exist, this does nothing (safe to run every time).
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      "buildClubId" TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      descriptor TEXT NOT NULL,        -- the "face fingerprint" saved as JSON text
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      "buildClubId" TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      "checkIn" TEXT NOT NULL,
      "checkOut" TEXT,
      hours REAL
    )
  `);

  console.log('✅ Database ready (tables created if they didn\'t exist).');
}

module.exports = { pool, initDb };
