// ============================================================
// db/queries/users.js
// ------------------------------------------------------------

const { pool } = require('../pool');

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, suspended, suspended_at,
            suspended_reason, created_at
       FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, password_hash, suspended,
            suspended_at, suspended_reason, created_at
       FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role = 'student' }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, suspended, created_at`,
    [name, email.toLowerCase(), passwordHash, role]
  );
  return rows[0];
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, suspended, suspended_at,
            suspended_reason, created_at
       FROM users
      ORDER BY created_at DESC`
  );
  return rows;
}

async function updateRole(id, role) {
  const { rows } = await pool.query(
    `UPDATE users SET role = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, name, email, role, suspended, created_at`,
    [role, id]
  );
  return rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, name, email, role`,
    [passwordHash, id]
  );
  return rows[0] || null;
}

async function setSuspended(id, suspended, reason) {
  const { rows } = await pool.query(
    `UPDATE users
        SET suspended = $1,
            suspended_at = CASE WHEN $1 THEN now() ELSE NULL END,
            suspended_reason = CASE WHEN $1 THEN $2 ELSE NULL END,
            updated_at = now()
      WHERE id = $3
      RETURNING id, name, email, role, suspended, suspended_at,
                suspended_reason, created_at`,
    [suspended, reason || null, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query(
    'DELETE FROM users WHERE id = $1', [id]
  );
  return rowCount > 0;
}

async function countAll() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
}

async function countAdmins() {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'"
  );
  return rows[0].n;
}

async function countStudents() {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM users WHERE role = 'student'"
  );
  return rows[0].n;
}

async function countNewSince(days) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users
      WHERE created_at >= now() - ($1 || ' days')::interval`,
    [String(days)]
  );
  return rows[0].n;
}

// ---------- Activity feed for one user ----------

async function getActivity(userId, { limit = 40 } = {}) {
  const items = [];

  // Messages this user sent
  try {
    const m = await pool.query(
      `SELECT m.id, m.content, m.created_at, c.title AS conversation_title
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user'
        ORDER BY m.created_at DESC
        LIMIT $2`,
      [userId, limit]
    );
    for (const r of m.rows) {
      items.push({
        type: 'message',
        icon: 'fa-comment',
        title: 'Sent a message',
        detail: (r.content || '').slice(0, 80) + ((r.content || '').length > 80 ? '…' : ''),
        subtitle: r.conversation_title || 'Untitled',
        at: r.created_at,
      });
    }
  } catch (_) {}

  // Quiz attempts
  try {
    const q = await pool.query(
      `SELECT qa.id, qa.score, qa.total, qa.completed_at, q.topic
         FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.user_id = $1
        ORDER BY qa.completed_at DESC
        LIMIT $2`,
      [userId, limit]
    );
    for (const r of q.rows) {
      items.push({
        type: 'quiz',
        icon: 'fa-circle-question',
        title: 'Took a quiz',
        detail: `${r.score}/${r.total} on ${r.topic || 'a quiz'}`,
        at: r.completed_at,
      });
    }
  } catch (_) {}

  // Flashcard reviews
  try {
    const f = await pool.query(
      `SELECT fr.id, fr.quality, fr.reviewed_at
         FROM flashcard_reviews fr
        WHERE fr.user_id = $1
        ORDER BY fr.reviewed_at DESC
        LIMIT $2`,
      [userId, limit]
    );
    for (const r of f.rows) {
      items.push({
        type: 'flashcard',
        icon: 'fa-clone',
        title: 'Reviewed a flashcard',
        detail: r.quality === 0 ? 'Marked "Again"'
              : r.quality === 1 ? 'Marked "Hard"'
              : r.quality === 2 ? 'Marked "Good"'
              : 'Marked "Easy"',
        at: r.reviewed_at,
      });
    }
  } catch (_) {}

  // Newest first
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}

module.exports = {
  findById, findByEmail, create, listAll,
  updateRole, updatePassword, setSuspended, remove,
  countAll, countAdmins, countStudents, countNewSince,
  getActivity,
};