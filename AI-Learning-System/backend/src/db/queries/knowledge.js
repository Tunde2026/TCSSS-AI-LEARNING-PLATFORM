// ============================================================
// db/queries/knowledge.js
// ------------------------------------------------------------
// Queries for the AI Knowledge admin panel.
// ============================================================

const { pool } = require('../pool');

async function getStats() {
  const out = {};
  const queries = {
    documents:          'SELECT COUNT(*)::int AS n FROM library_documents',
    approved_documents: 'SELECT COUNT(*)::int AS n FROM library_documents WHERE approved = TRUE',
    chunks:             'SELECT COUNT(*)::int AS n FROM document_chunks',
    approved_chunks:    'SELECT COUNT(*)::int AS n FROM document_chunks WHERE approved = TRUE',
    embedded_chunks:    'SELECT COUNT(*)::int AS n FROM document_chunks WHERE embedding IS NOT NULL',
    failed_documents:   "SELECT COUNT(*)::int AS n FROM library_documents WHERE processing_status = 'failed'",
    processing:         "SELECT COUNT(*)::int AS n FROM library_documents WHERE processing_status = 'processing'",
  };
  for (const [key, sql] of Object.entries(queries)) {
    try {
      const r = await pool.query(sql);
      out[key] = r.rows[0].n;
    } catch (_) {
      out[key] = 0;
    }
  }
  return out;
}

async function listDocuments({ status } = {}) {
  let sql = `
    SELECT d.id, d.title, d.subject, d.level, d.author,
           d.original_name, d.mime_type, d.size_bytes,
           d.status, d.approved, d.processing_status,
           d.processing_error, d.chunk_count,
           d.uploaded_at, d.processed_at,
           u.name AS uploader_name
      FROM library_documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
  `;
  const params = [];
  if (status && status !== 'all') {
    sql += ' WHERE d.processing_status = $1';
    params.push(status);
  }
  sql += ' ORDER BY d.uploaded_at DESC';
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function listChunks(documentId, { limit = 100, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT id, position, content, approved, created_at,
            (embedding IS NOT NULL) AS has_embedding
       FROM document_chunks
      WHERE document_id = $1
      ORDER BY position ASC
      LIMIT $2 OFFSET $3`,
    [documentId, limit, offset]
  );
  return rows;
}

async function setChunkApproved(id, approved) {
  const { rows } = await pool.query(
    `UPDATE document_chunks SET approved = $1 WHERE id = $2
     RETURNING id, document_id, position, content, approved`,
    [approved, id]
  );
  return rows[0] || null;
}

async function removeChunk(id) {
  const { rowCount } = await pool.query(
    'DELETE FROM document_chunks WHERE id = $1', [id]
  );
  return rowCount > 0;
}

module.exports = {
  getStats,
  listDocuments,
  listChunks,
  setChunkApproved,
  removeChunk,
};