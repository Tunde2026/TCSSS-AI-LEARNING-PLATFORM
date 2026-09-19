const { pool } = require('../pool');

async function listByConversation(conversationId) {
  const { rows } = await pool.query(
    `SELECT id, role, content, provider, created_at
       FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

async function create({ conversationId, role, content, provider = null }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, provider)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, content, provider, created_at`,
    [conversationId, role, content, provider]
  );
  return rows[0];
}

module.exports = { listByConversation, create };