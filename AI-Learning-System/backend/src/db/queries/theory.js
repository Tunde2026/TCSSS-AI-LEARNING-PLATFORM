// ============================================================
// db/queries/theory.js
// ------------------------------------------------------------
// Data access for Theory — fill-in-the-gap questions.
//
// Tables:
//   theory_sets        — one row per set (topic/quiz)
//   theory_questions   — questions inside a set
//   theory_attempts    — student submissions
// ============================================================

const { pool } = require('../pool');

/* ============================================================
   SETS
   ============================================================ */

async function createSet(input) {
  const {
    userId, title, subject = null, topic = null,
    difficulty = 'medium', sourceType = 'manual',
    aiGenerated = false, description = null,
  } = input;

  const { rows } = await pool.query(
    `INSERT INTO theory_sets
       (user_id, title, subject, topic, difficulty,
        source_type, ai_generated, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId, title, subject, topic, difficulty,
      sourceType, aiGenerated, description,
    ]
  );
  return rows[0];
}

async function findSetById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM theory_sets WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function findFullSet(id) {
  const set = await findSetById(id);
  if (!set) return null;
  set.questions = await listQuestionsForSet(id);
  return set;
}

async function listSetsForUser(userId, { limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*)::int FROM theory_questions q WHERE q.set_id = s.id) AS question_count
       FROM theory_sets s
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function removeSet(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM theory_sets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

async function renameSet(id, userId, title) {
  const { rows } = await pool.query(
    `UPDATE theory_sets SET title = $1
      WHERE id = $2 AND user_id = $3
      RETURNING *`,
    [title, id, userId]
  );
  return rows[0] || null;
}

async function setDescription(id, userId, description) {
  const { rows } = await pool.query(
    `UPDATE theory_sets SET description = $1
      WHERE id = $2 AND user_id = $3
      RETURNING *`,
    [description || null, id, userId]
  );
  return rows[0] || null;
}

/* ============================================================
   QUESTIONS
   ============================================================ */

async function addQuestions(setId, questions) {
  if (!Array.isArray(questions) || !questions.length) return [];

  const inserted = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { rows } = await pool.query(
      `INSERT INTO theory_questions
         (set_id, position, template, accepted_answers, hint, explanation)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        setId,
        typeof q.position === 'number' ? q.position : i,
        q.template,
        JSON.stringify(q.accepted_answers || []),
        q.hint || null,
        q.explanation || null,
      ]
    );
    inserted.push(rows[0]);
  }
  return inserted;
}

async function listQuestionsForSet(setId) {
  const { rows } = await pool.query(
    `SELECT * FROM theory_questions
      WHERE set_id = $1
      ORDER BY position ASC, created_at ASC`,
    [setId]
  );
  return rows;
}

/* ============================================================
   ATTEMPTS
   ============================================================ */

async function saveAttempt(input) {
  const {
    setId, userId, score, total, answers,
    timeTakenSeconds = null,
  } = input;

  const { rows } = await pool.query(
    `INSERT INTO theory_attempts
       (set_id, user_id, score, total, answers, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      setId, userId, score, total,
      JSON.stringify(answers || []),
      timeTakenSeconds,
    ]
  );
  return rows[0];
}

async function listAttemptsForUser(userId, { limit = 50 } = {}) {
  const { rows } = await pool.query(
    `SELECT a.id, a.set_id, a.score, a.total, a.completed_at,
            s.title, s.topic, s.subject, s.description
       FROM theory_attempts a
       JOIN theory_sets s ON s.id = a.set_id
      WHERE a.user_id = $1
      ORDER BY a.completed_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function listAttemptsForSet(setId, userId, { limit = 20 } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM theory_attempts
      WHERE set_id = $1 AND user_id = $2
      ORDER BY completed_at DESC
      LIMIT $3`,
    [setId, userId, limit]
  );
  return rows;
}

async function findAttemptById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM theory_attempts WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/* ============================================================
   STATS
   ============================================================ */

async function countSetsForUser(userId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM theory_sets WHERE user_id = $1',
    [userId]
  );
  return rows[0].n;
}

module.exports = {
  createSet,
  findSetById,
  findFullSet,
  listSetsForUser,
  removeSet,
  renameSet,
  setDescription,

  addQuestions,
  listQuestionsForSet,

  saveAttempt,
  listAttemptsForUser,
  listAttemptsForSet,
  findAttemptById,

  countSetsForUser,
};