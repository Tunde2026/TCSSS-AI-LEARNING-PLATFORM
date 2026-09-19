const { pool } = require('../pool');
const { toVectorLiteral } = require('../../library/embedding');

async function replaceForDocument(documentId, chunks) {
  // Delete existing chunks, insert new ones in one transaction.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

    if (chunks.length) {
      const params = [documentId];
      const values = [];
      chunks.forEach((c, i) => {
        const o = params.length;
        values.push(`($1, $${o+1}, $${o+2}, $${o+3}::vector, $${o+4})`);
        params.push(i + 1, c.content, toVectorLiteral(c.embedding), !!c.approved);
      });
      await client.query(
        `INSERT INTO document_chunks (document_id, position, content, embedding, approved)
         VALUES ${values.join(', ')}`,
        params
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function setApprovedByDocument(documentId, approved) {
  await pool.query(
    `UPDATE document_chunks SET approved = $1 WHERE document_id = $2`,
    [approved, documentId]
  );
}

// Cosine similarity search over approved chunks.
// Returns the top K most similar chunks with similarity score.
async function searchByVector(queryEmbedding, limit = 5, minSimilarity = 0.65) {
  const vecLiteral = toVectorLiteral(queryEmbedding);

  const { rows } = await pool.query(
    `SELECT
        dc.id,
        dc.document_id,
        dc.position,
        dc.content,
        (1 - (dc.embedding <=> $1::vector)) AS similarity,
        d.title    AS document_title,
        d.subject  AS document_subject,
        d.level    AS document_level
       FROM document_chunks dc
       JOIN library_documents d ON d.id = dc.document_id
      WHERE dc.approved = TRUE
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2`,
    [vecLiteral, limit]
  );

  return rows.filter(r => r.similarity >= minSimilarity);
}

async function countApproved() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM document_chunks WHERE approved = TRUE`
  );
  return rows[0].n;
}

module.exports = {
  replaceForDocument,
  setApprovedByDocument,
  searchByVector,
  countApproved,
};