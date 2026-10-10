// ============================================================
// db/pool.js
// ------------------------------------------------------------
// Shared PostgreSQL pool with generous timeouts, so slow
// cold starts (local Postgres, Neon over the internet) don't
// fail. Every caller uses `db.pool` exactly as before.
// ============================================================

const { Pool } = require('pg');
const { config } = require('../core');

const connectionString = config.db.url;

if (!connectionString) {
  console.error('[db] DATABASE_URL is not set. Pool will fail on first query.');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  // 30 seconds — enough for a cold Neon connect over slow internet
  connectionTimeoutMillis: 30000,
  // Kill any query that takes longer than 20s (prevents hanging server)
  statement_timeout: 20000,
  query_timeout: 20000,
});

pool.on('error', function (err) {
  console.error('[db] Idle client error:', err.message);
});

async function ping() {
  const res = await pool.query('SELECT now() AS now');
  return res.rows[0].now;
}

/**
 * Wait for the DB to be reachable. Retries with backoff.
 * Called at boot so the server doesn't start in a broken state.
 */
async function waitForDb(maxAttempts) {
  maxAttempts = maxAttempts || 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      try { await client.query('SELECT 1'); } finally { client.release(); }
      console.log('[db] Connected on attempt ' + attempt);
      return true;
    } catch (err) {
      console.error('[db] Attempt ' + attempt + ' failed: ' + err.message);
      if (attempt === maxAttempts) return false;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(function (r) { setTimeout(r, delay); });
    }
  }
  return false;
}

module.exports = { pool, ping, waitForDb };
