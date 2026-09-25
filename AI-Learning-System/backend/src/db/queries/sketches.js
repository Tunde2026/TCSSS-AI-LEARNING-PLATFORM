// ============================================================
// db/queries/sketches.js
// ------------------------------------------------------------
// CRUD for the sketches table (saved formulas).
// ============================================================

const { pool } = require('../pool');

async function create(input) {
  const {
    userId, title = null, subject = null,
    rawInput, renderedHtml, renderedText = null, kind = 'formula',
  } = input;

  const { rows } = await pool.query(
    `INSERT INTO sketches
       (user_id, title, subject, raw_input, rendered_html, rendered_text, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, title, subject, rawInput, renderedHtml, renderedText, kind]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM sketches WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function listForUser(userId, { limit = 100 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, title, subject, raw_input, rendered_text, kind, created_at, updated_at
       FROM sketches
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function update(id, userId, fields) {
  const updates = [];
  const values = [];

  if (fields.title !== undefined)      { updates.push('title = $' + (values.length + 1));      values.push(fields.title); }
  if (fields.subject !== undefined)    { updates.push('subject = $' + (values.length + 1));    values.push(fields.subject); }
  if (fields.rawInput !== undefined)   { updates.push('raw_input = $' + (values.length + 1));   values.push(fields.rawInput); }
  if (fields.renderedHtml !== undefined) { updates.push('rendered_html = $' + (values.length + 1)); values.push(fields.renderedHtml); }
  if (fields.renderedText !== undefined) { updates.push('rendered_text = $' + (values.length + 1)); values.push(fields.renderedText); }

  if (!updates.length) return findById(id);

  updates.push('updated_at = now()');
  values.push(id);
  values.push(userId);

  const { rows } = await pool.query(
    `UPDATE sketches SET ${updates.join(', ')}
      WHERE id = $${values.length - 1} AND user_id = $${values.length}
      RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM sketches WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = {
  create,
  findById,
  listForUser,
  update,
  remove,
};