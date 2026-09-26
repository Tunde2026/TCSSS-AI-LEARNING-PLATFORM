const { pool } = require('../pool');

async function createSet({ userId, title, topic, subject, difficulty, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO practice_sets (user_id, title, topic, subject, difficulty, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, title, topic, subject, difficulty, description, created_at`,
    [userId, title, topic, subject || null, difficulty || 'medium', description]
  );
  return rows[0];
}

async function addQuestions(setId, questions) {
  if (!questions.length) return;
  const params = [setId];
  const values = [];
  questions.forEach((q, i) => {
    const o = params.length;
    values.push(`($1, $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`);
    params.push(i + 1, q.question, q.answer, q.hint || null);
  });
  await pool.query(
    `INSERT INTO practice_questions (set_id, position, question, answer, hint)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function findSet(id) {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, topic, subject, difficulty, description, created_at
       FROM practice_sets WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const set = rows[0];
  const q = await pool.query(
    `SELECT id, position, question, answer, hint
       FROM practice_questions
      WHERE set_id = $1
      ORDER BY position ASC`,
    [id]
  );
  set.questions = q.rows;
  return set;
}

async function listSets(userId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.topic, s.subject, s.difficulty, s.description, s.created_at,
            COUNT(q.id)::int AS question_count
       FROM practice_sets s
       LEFT JOIN practice_questions q ON q.set_id = s.id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows;
}

async function setDescription(id, userId, description) {
  const { rows } = await pool.query(
    `UPDATE practice_sets SET description = $1
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, topic, subject, difficulty, description, created_at`,
    [description || null, id, userId]
  );
  return rows[0] || null;
}

async function removeSet(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM practice_sets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { createSet, addQuestions, findSet, listSets, setDescription, removeSet };