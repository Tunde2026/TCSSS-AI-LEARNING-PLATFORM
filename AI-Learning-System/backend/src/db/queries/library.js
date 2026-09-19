const { pool } = require('../pool');

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO library_documents
       (uploaded_by, title, subject, level, author, filename,
        original_name, mime_type, size_bytes, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.uploadedBy, data.title, data.subject || null, data.level || null,
      data.author || null, data.filename, data.originalName,
      data.mimeType, data.sizeBytes, data.storagePath,
    ]
  );
  return rows[0];
}

async function listApproved() {
  const { rows } = await pool.query(
    `SELECT id, title, subject, level, author, original_name, mime_type,
            size_bytes, uploaded_at
       FROM library_documents
      WHERE approved = TRUE
      ORDER BY uploaded_at DESC`
  );
  return rows;
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS uploader_name, u.email AS uploader_email
       FROM library_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
      ORDER BY d.uploaded_at DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM library_documents WHERE id = $1`, [id]
  );
  return rows[0] || null;
}

async function setApproved(id, approved, adminId) {
  const { rows } = await pool.query(
    `UPDATE library_documents
        SET approved = $1, status = $2,
            approved_at = CASE WHEN $1 THEN now() ELSE NULL END,
            approved_by = CASE WHEN $1 THEN $3 ELSE NULL END
      WHERE id = $4
      RETURNING *`,
    [approved, approved ? 'approved' : 'rejected', adminId, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM library_documents WHERE id = $1`, [id]
  );
  return rowCount > 0;
}

module.exports = {
  create, listApproved, listAll, findById, setApproved, remove,
};