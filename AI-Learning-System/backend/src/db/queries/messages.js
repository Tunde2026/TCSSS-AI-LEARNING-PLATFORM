// ============================================================
// db/queries/messages.js
// ------------------------------------------------------------

const { pool } = require('../pool');

async function listByConversation(conversationId) {
  const { rows } = await pool.query(
    `SELECT id, role, content, provider, media, created_at
       FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

async function create(input) {
  const conversationId = input.conversationId;
  const role           = input.role;
  const content        = input.content;
  const provider       = input.provider != null ? input.provider : null;
  const media          = input.media != null ? input.media : null;

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, role, content, provider, media)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, role, content, provider, media, created_at`,
    [
      conversationId,
      role,
      content,
      provider,
      media ? JSON.stringify(media) : null,
    ]
  );
  return rows[0];
}

module.exports = { listByConversation, create };
