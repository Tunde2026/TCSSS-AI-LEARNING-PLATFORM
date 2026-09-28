// ============================================================
// db/pool.js — with connection retry logic
// ============================================================
const { Pool } = require('pg');
const { config } = require('../core');

let pool = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectWithRetry(maxAttempts = 5) {
  if (pool) return pool;

  const connectionString = config.db.url;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const candidate = new Pool({
        connectionString,
        ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection immediately
      const client = await candidate.connect();
      await client.query('SELECT 1');
      client.release();

      pool = candidate;
      console.log(`[db] Connected to PostgreSQL on attempt ${attempt}`);
      return pool;
    } catch (err) {
      console.error(`[db] Connection attempt ${attempt} failed: ${err.message}`);

      if (attempt === maxAttempts) {
        throw new Error(`[db] Could not connect after ${maxAttempts} attempts. Last error: ${err.message}`);
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
      console.log(`[db] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

async function getPool() {
  if (!pool) {
    await connectWithRetry();
  }
  return pool;
}

async function ping() {
  const p = await getPool();
  const res = await p.query('SELECT now() AS now');
  return res.rows[0].now;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, ping, close };