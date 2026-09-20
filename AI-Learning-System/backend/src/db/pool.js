const { Pool } = require('pg');
const config = require('../core/config');
const logger = require('../core/logger');

const isProduction = config.nodeEnv === 'production';

const pool = new Pool({
  connectionString: config.db.url,
  max: isProduction ? 5 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

async function ping() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0].now;
}

module.exports = { pool, ping };
