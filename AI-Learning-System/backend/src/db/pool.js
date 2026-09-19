// PostgreSQL connection pool.
// Connects lazily — the server boots fine without PostgreSQL running,
// but the first query will fail until the database is up.

const { Pool } = require('pg');
const config = require('../core/config');
const logger = require('../core/logger');

const pool = new Pool({
  connectionString: config.db.url,
  max: 10,                    // max clients in the pool
  idleTimeoutMillis: 30000,   // close idle clients after 30s
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

// Test helper — call this from a route to verify DB connectivity.
async function ping() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0].now;
}

module.exports = { pool, ping };