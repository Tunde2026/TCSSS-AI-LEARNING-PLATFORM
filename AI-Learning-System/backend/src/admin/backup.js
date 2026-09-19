// ============================================================
// admin/backup.js
// ------------------------------------------------------------
// Export/import all user-facing data as JSON.
// ============================================================

const db     = require('../db');
const logger = require('../core/logger');

// Tables to export and the ORDER they must be restored in
// (respecting foreign keys).
const TABLES = [
  { name: 'users',               order: 'created_at ASC' },
  { name: 'conversations',       order: 'created_at ASC' },
  { name: 'messages',            order: 'created_at ASC' },
  { name: 'quizzes',             order: 'created_at ASC' },
  { name: 'quiz_questions',      order: 'created_at ASC' },
  { name: 'quiz_attempts',       order: 'completed_at ASC' },
  { name: 'flashcard_decks',     order: 'created_at ASC' },
  { name: 'flashcards',          order: 'created_at ASC' },
  { name: 'flashcard_reviews',   order: 'reviewed_at ASC' },
  { name: 'custom_agents',       order: 'created_at ASC' },
  { name: 'library_documents',   order: 'uploaded_at ASC' },
  { name: 'document_chunks',     order: 'created_at ASC', hasVector: true },
  { name: 'provider_credentials', order: 'created_at ASC' },
  { name: 'system_settings',     order: 'key ASC' },
  { name: 'audit_log',           order: 'created_at ASC' },
];

async function exportAll() {
  const out = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {},
  };

  for (const t of TABLES) {
    try {
      let sql;
      if (t.hasVector) {
        // Convert vector to array of numbers
        sql = `SELECT *, embedding::text AS embedding_text FROM ${t.name} ORDER BY ${t.order}`;
      } else {
        sql = `SELECT * FROM ${t.name} ORDER BY ${t.order}`;
      }
      const r = await db.pool.query(sql);

      out.tables[t.name] = r.rows.map(row => {
        if (t.hasVector) {
          // Prefer the text form for round-tripping
          row.embedding = row.embedding_text;
          delete row.embedding_text;
        }
        return row;
      });
    } catch (err) {
      logger.warn(`[backup] export failed for ${t.name}:`, err.message);
      out.tables[t.name] = [];
    }
  }

  return out;
}

async function importAll(data) {
  if (!data || typeof data !== 'object' || !data.tables) {
    return { ok: false, code: 'INVALID_PAYLOAD' };
  }
  if (data.version !== 1) {
    return { ok: false, code: 'UNSUPPORTED_VERSION' };
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Truncate all tables in reverse dependency order, cascading.
    const truncateOrder = [...TABLES].reverse();
    for (const t of truncateOrder) {
      try {
        await client.query(`TRUNCATE TABLE ${t.name} CASCADE`);
      } catch (_) { /* some tables may not exist yet */ }
    }

    // Insert in forward order.
    const counts = {};
    for (const t of TABLES) {
      const rows = data.tables[t.name] || [];
      counts[t.name] = 0;
      if (!rows.length) continue;

      // Build column list from first row
      const columns = Object.keys(rows[0]);
      const columnList = columns.map(c => `"${c}"`).join(', ');

      // For vector column, cast the string to ::vector
      const valuesTemplate = columns.map((c, i) => {
        if (t.hasVector && c === 'embedding') return `$${i + 1}::vector`;
        return `$${i + 1}`;
      }).join(', ');

      for (const row of rows) {
        const values = columns.map(c => {
          let v = row[c];
          if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
            v = JSON.stringify(v);
          }
          return v;
        });
        try {
          await client.query(
            `INSERT INTO ${t.name} (${columnList}) VALUES (${valuesTemplate})`,
            values
          );
          counts[t.name] += 1;
        } catch (rowErr) {
          logger.warn(`[backup] row insert into ${t.name} failed:`, rowErr.message);
        }
      }
    }

    await client.query('COMMIT');
    logger.info('[backup] import complete:', counts);
    return { ok: true, counts };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[backup] import failed:', err.message);
    return { ok: false, code: 'IMPORT_FAILED', detail: err.message };
  } finally {
    client.release();
  }
}

module.exports = { exportAll, importAll, TABLES };