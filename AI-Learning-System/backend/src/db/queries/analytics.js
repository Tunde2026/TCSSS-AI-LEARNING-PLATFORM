// ============================================================
// db/queries/analytics.js
// ------------------------------------------------------------
// Aggregated stats for the admin Analytics page.
// ============================================================

const { pool } = require('../pool');

async function getSummary() {
  const out = {};
  const queries = {
    users:             'SELECT COUNT(*)::int AS n FROM users',
    conversations:     'SELECT COUNT(*)::int AS n FROM conversations',
    messages:          'SELECT COUNT(*)::int AS n FROM messages',
    quizzes:           'SELECT COUNT(*)::int AS n FROM quizzes',
    quiz_attempts:     'SELECT COUNT(*)::int AS n FROM quiz_attempts',
    flashcards:        'SELECT COUNT(*)::int AS n FROM flashcards',
    flashcard_reviews: 'SELECT COUNT(*)::int AS n FROM flashcard_reviews',
    documents:         'SELECT COUNT(*)::int AS n FROM library_documents',
    chunks:            'SELECT COUNT(*)::int AS n FROM document_chunks',
    agents:            'SELECT COUNT(*)::int AS n FROM custom_agents',
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

async function getMessagesByDay(days = 30) {
  const { rows } = await pool.query(
    `SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
       FROM messages
      WHERE created_at >= now() - ($1 || ' days')::interval
      GROUP BY day
      ORDER BY day ASC`,
    [String(days)]
  );
  return rows;
}

async function getUsersByDay(days = 30) {
  const { rows } = await pool.query(
    `SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
       FROM users
      WHERE created_at >= now() - ($1 || ' days')::interval
      GROUP BY day
      ORDER BY day ASC`,
    [String(days)]
  );
  return rows;
}

async function getProviderUsage() {
  const { rows } = await pool.query(
    `SELECT COALESCE(provider, 'unknown') AS provider, COUNT(*)::int AS count
       FROM messages
      WHERE role = 'assistant'
      GROUP BY provider
      ORDER BY count DESC`
  );
  return rows;
}

async function getRecentActivity({ limit = 20 } = {}) {
  const { rows } = await pool.query(
    `SELECT m.id, m.role, m.provider, m.created_at,
            c.title AS conversation_title,
            u.name AS user_name, u.email AS user_email
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN users u ON u.id = c.user_id
      ORDER BY m.created_at DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getTopQuizTopics({ limit = 10 } = {}) {
  const { rows } = await pool.query(
    `SELECT q.topic,
            COUNT(DISTINCT q.id)::int AS quiz_count,
            COUNT(qa.id)::int AS attempt_count
       FROM quizzes q
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
      GROUP BY q.topic
      ORDER BY quiz_count DESC
      LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  getSummary,
  getMessagesByDay,
  getUsersByDay,
  getProviderUsage,
  getRecentActivity,
  getTopQuizTopics,
};