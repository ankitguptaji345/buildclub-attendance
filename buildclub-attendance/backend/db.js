// db.js
// This file sets up our tiny database (like a phonebook + a logbook).
// It uses SQLite, which just saves everything into ONE simple file called attendance.db
// You don't need to install any separate database software - it just works.

const Database = require('better-sqlite3');
const path = require('path');

// This creates (or opens, if it already exists) attendance.db right inside the backend folder
const db = new Database(path.join(__dirname, 'attendance.db'));
db.pragma('journal_mode = WAL');

// TABLE 1: "members" -> our phonebook of registered faces
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buildClubId TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    descriptor TEXT NOT NULL,        -- the "face fingerprint" saved as JSON text
    createdAt TEXT DEFAULT (datetime('now'))
  )
`);

// TABLE 2: "attendance" -> our logbook of check-ins and check-outs
db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buildClubId TEXT NOT NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    checkIn TEXT NOT NULL,
    checkOut TEXT,
    hours REAL
  )
`);

module.exports = db;
