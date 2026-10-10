// ============================================================
// db/pool.js
// ------------------------------------------------------------
// Shared PostgreSQL pool.
//
// IMPORTANT: this module exports { pool, ping, waitForDb }.
// pool is a real pg Pool instance.
//
// Config is loaded DEFENSIVELY via try/catch, falling back to
// process.env, to survive circular-dependency moments during
// module init (e.g. when gateway.js is required standalone).
// ============================================================

const { Pool } = require('pg');

function loadConfig() {
  try {
    const core = require('../core');
    return (core && core.config) || null;
  } catch (_) { return null; }
}

const config = loadConfig() || {};

const connectionString =
  (config.db && config.db.url) ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[db] DATABASE_URL is not set. The pool will fail on first query.');
}

const isProd = (config.nodeEnv === 'production') ||
               (process.env.NODE_ENV === 'production');

const pool = new Pool({
  connectionString: connectionString,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', function (err) {
  console.error('[db] Idle client error:', err.message);
});

async function ping() {
  const res = await pool.query('SELECT now() AS now');
  return res.rows[0].now;
}

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
