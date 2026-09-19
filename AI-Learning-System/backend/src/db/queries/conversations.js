const { pool } = require('../pool');

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, pinned, created_at, updated_at
       FROM conversations
      WHERE user_id = $1
      ORDER BY pinned DESC, updated_at DESC`,
    [userId]
  );
  return rows;
}

async function create(userId, title = 'New conversation') {
  const { rows } = await pool.query(
    `INSERT INTO conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING id, title, pinned, created_at, updated_at`,
    [userId, title]
  );
  return rows[0];
}

async function rename(id, userId, title) {
  const { rows } = await pool.query(
    `UPDATE conversations
        SET title = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, pinned, created_at, updated_at`,
    [title, id, userId]
  );
  return rows[0] || null;
}

async function setPinned(id, userId, pinned) {
  const { rows } = await pool.query(
    `UPDATE conversations
        SET pinned = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, pinned, created_at, updated_at`,
    [pinned, id, userId]
  );
  return rows[0] || null;
}

async function touch(conversationId) {
  await pool.query(
    `UPDATE conversations SET updated_at = now() WHERE id = $1`,
    [conversationId]
  );
}

async function remove(conversationId, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rowCount > 0;
}

module.exports = { listByUser, create, rename, setPinned, touch, remove };