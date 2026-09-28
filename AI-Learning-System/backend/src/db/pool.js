// ============================================================
// db/pool.js
// ------------------------------------------------------------
// Shared PostgreSQL pool.
//
// IMPORTANT: this module exports `{ pool, ping }`.
// `pool` is a real, ready-to-use pg Pool instance. Every other
// module in the project does:
//
//     const db = require('../db');
//     await db.pool.query('SELECT ...');
//
// Do NOT change this export shape without updating every caller.
// ============================================================

const { Pool } = require('pg');
const { config } = require('../core');

const connectionString = config.db.url;

if (!connectionString) {
  console.error('[db] DATABASE_URL is not set. The pool will fail on first query.');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

// Never let a background idle-client error crash the process.
pool.on('error', function (err) {
  console.error('[db] Idle client error:', err.message);
});

// Simple helper: run a quick SELECT 1 to verify the DB is reachable.
async function ping() {
  const res = await pool.query('SELECT now() AS now');
  return res.rows[0].now;
}

// Optional: for callers that want a retrying connect at boot.
// This does NOT replace `pool` — it just proves the connection.
async function waitForDb(maxAttempts) {
  maxAttempts = maxAttempts || 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      try { await client.query('SELECT 1'); } finally { client.release(); }
      console.log('[db] Connected on attempt ' + attempt);
      return true;
    } catch (err) {
      console.error('[db] Attempt ' + attempt + ' failed: ' + err.message);
      if (attempt === maxAttempts) return false;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      await new Promise(function (r) { setTimeout(r, delay); });
    }
  }
  return false;
}

module.exports = { pool, ping, waitForDb };
