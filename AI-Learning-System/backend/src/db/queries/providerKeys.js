// ============================================================
// db/queries/providerKeys.js
// ------------------------------------------------------------
// CRUD for provider API keys stored in the database.
// ============================================================

const { pool } = require('../pool');

async function listAll() {
  const { rows } = await pool.query(
    `SELECT id, provider, label, key_value, enabled,
            last_used_at, last_error, created_at, updated_at
       FROM provider_credentials
      ORDER BY provider ASC, created_at ASC`
  );
  return rows;
}

async function listEnabled() {
  const { rows } = await pool.query(
    `SELECT id, provider, key_value
       FROM provider_credentials
      WHERE enabled = TRUE
      ORDER BY provider ASC, created_at ASC`
  );
  return rows;
}

async function create({ provider, label, keyValue }) {
  const { rows } = await pool.query(
    `INSERT INTO provider_credentials (provider, label, key_value)
     VALUES ($1, $2, $3)
     RETURNING id, provider, label, key_value, enabled, created_at`,
    [provider, label || null, keyValue]
  );
  return rows[0];
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  let i = 1;

  if (fields.label !== undefined)    { sets.push(`label = $${i++}`);     params.push(fields.label); }
  if (fields.keyValue !== undefined) { sets.push(`key_value = $${i++}`); params.push(fields.keyValue); }
  if (fields.enabled !== undefined)  { sets.push(`enabled = $${i++}`);   params.push(fields.enabled); }

  if (!sets.length) return null;
  sets.push('updated_at = now()');
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE provider_credentials
        SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING id, provider, label, key_value, enabled, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query(
    'DELETE FROM provider_credentials WHERE id = $1', [id]
  );
  return rowCount > 0;
}

module.exports = { listAll, listEnabled, create, update, remove };