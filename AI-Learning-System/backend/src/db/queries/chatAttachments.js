const { pool } = require('../pool');

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO chat_attachments
       (user_id, conversation_id, filename, original_name, mime_type,
        size_bytes, storage_path, extraction_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id, filename, original_name, mime_type, size_bytes,
               extraction_status, created_at`,
    [
      data.userId,
      data.conversationId || null,
      data.filename,
      data.originalName,
      data.mimeType,
      data.sizeBytes,
      data.storagePath,
    ]
  );
  return rows[0];
}

async function setExtraction(id, status, text, error) {
  await pool.query(
    `UPDATE chat_attachments
        SET extracted_text = $1, extraction_status = $2, extraction_error = $3
      WHERE id = $4`,
    [text || null, status, error || null, id]
  );
}

async function findById(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM chat_attachments WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

async function listByIds(ids, userId) {
  if (!ids || !ids.length) return [];
  const { rows } = await pool.query(
    `SELECT id, original_name, mime_type, extracted_text, extraction_status
       FROM chat_attachments
      WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [ids, userId]
  );
  return rows;
}

async function linkToConversation(ids, conversationId) {
  if (!ids || !ids.length) return;
  await pool.query(
    `UPDATE chat_attachments SET conversation_id = $1 WHERE id = ANY($2::uuid[])`,
    [conversationId, ids]
  );
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM chat_attachments WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = {
  create, setExtraction, findById, listByIds,
  linkToConversation, remove,
};