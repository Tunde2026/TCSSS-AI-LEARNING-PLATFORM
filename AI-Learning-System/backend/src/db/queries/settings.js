// ============================================================
// db/queries/settings.js
// ------------------------------------------------------------
// All database operations for the system_settings table.
// ============================================================

const { pool } = require('../pool');

async function listAll() {
  const { rows } = await pool.query(
    `SELECT key, value, type, description, category, updated_at
       FROM system_settings
      ORDER BY category, key`
  );
  return rows;
}

async function get(key) {
  const { rows } = await pool.query(
    `SELECT key, value, type FROM system_settings WHERE key = $1`,
    [key]
  );
  return rows[0] || null;
}

async function set(key, value, type, updatedBy) {
  const { rows } = await pool.query(
    `INSERT INTO system_settings (key, value, type, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           type = EXCLUDED.type,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
     RETURNING key, value, type, updated_at`,
    [key, JSON.stringify(value), type, updatedBy]
  );
  return rows[0];
}

async function setMany(entries, updatedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const { key, value, type } of entries) {
      const r = await client.query(
        `INSERT INTO system_settings (key, value, type, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               type = EXCLUDED.type,
               updated_by = EXCLUDED.updated_by,
               updated_at = now()
         RETURNING key, value, type, updated_at`,
        [key, JSON.stringify(value), type, updatedBy]
      );
      results.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listAll, get, set, setMany };