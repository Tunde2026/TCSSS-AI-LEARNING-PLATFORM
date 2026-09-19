const { pool } = require('../pool');

async function listByUser(userId, { search } = {}) {
  const params = [userId];
  let sql = `
    SELECT id, title, subject, created_at, updated_at,
           LEFT(content, 180) AS preview
      FROM notes
     WHERE user_id = $1
  `;
  if (search) {
    params.push('%' + search + '%');
    sql += ` AND (title ILIKE $2 OR content ILIKE $2)`;
  }
  sql += ' ORDER BY updated_at DESC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function findById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, title, content, subject, created_at, updated_at
       FROM notes WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function create({ userId, title, content, subject }) {
  const { rows } = await pool.query(
    `INSERT INTO notes (user_id, title, content, subject)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, content, subject, created_at, updated_at`,
    [userId, title || 'Untitled note', content || '', subject || null]
  );
  return rows[0];
}

async function update(id, userId, fields) {
  const sets = [];
  const params = [];
  let i = 1;

  if (fields.title !== undefined)   { sets.push(`title = $${i++}`);   params.push(fields.title); }
  if (fields.content !== undefined) { sets.push(`content = $${i++}`); params.push(fields.content); }
  if (fields.subject !== undefined) { sets.push(`subject = $${i++}`); params.push(fields.subject); }

  if (!sets.length) return null;
  sets.push('updated_at = now()');
  params.push(id, userId);

  const { rows } = await pool.query(
    `UPDATE notes SET ${sets.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
      RETURNING id, title, content, subject, created_at, updated_at`,
    params
  );
  return rows[0] || null;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { listByUser, findById, create, update, remove };