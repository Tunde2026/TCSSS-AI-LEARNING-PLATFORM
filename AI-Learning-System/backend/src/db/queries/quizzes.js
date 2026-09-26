const { pool } = require('../pool');

async function create({ userId, title, subject, topic, difficulty = 'medium',
                        isExam = false, timeLimitSeconds = null, description = null }) {
  const { rows } = await pool.query(
    `INSERT INTO quizzes
       (user_id, title, subject, topic, difficulty, is_exam, time_limit_seconds, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, title, subject, topic, difficulty,
               is_exam, time_limit_seconds, description, created_at, updated_at`,
    [userId, title, subject, topic, difficulty, isExam, timeLimitSeconds, description]
  );
  return rows[0];
}

async function addQuestions(quizId, questions) {
  const values = [];
  const params = [quizId];
  questions.forEach((q, i) => {
    const offset = params.length;
    values.push(`($1, $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
    params.push(i + 1, q.question, JSON.stringify(q.options), q.correct, q.explanation || null);
  });
  await pool.query(
    `INSERT INTO quiz_questions
       (quiz_id, position, question, options, correct_option, explanation)
     VALUES ${values.join(', ')}`,
    params
  );
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, subject, topic, difficulty,
            is_exam, time_limit_seconds, description, created_at, updated_at
       FROM quizzes WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const quiz = rows[0];
  const q = await pool.query(
    `SELECT id, position, question, options, correct_option, explanation
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY position ASC`,
    [id]
  );
  quiz.questions = q.rows;
  return quiz;
}

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, subject, topic, difficulty, is_exam,
            time_limit_seconds, description, created_at, updated_at
       FROM quizzes WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function setDescription(id, userId, description) {
  const { rows } = await pool.query(
    `UPDATE quizzes SET description = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, subject, topic, difficulty, is_exam,
                time_limit_seconds, description, created_at, updated_at`,
    [description || null, id, userId]
  );
  return rows[0] || null;
}

async function remove(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM quizzes WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

async function saveAttempt({ quizId, userId, score, total, answers,
                              isExam = false, timeLimitSeconds = null,
                              timeTakenSeconds = null }) {
  const { rows } = await pool.query(
    `INSERT INTO quiz_attempts
       (quiz_id, user_id, score, total, answers,
        is_exam, time_limit_seconds, time_taken_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, score, total, is_exam, time_limit_seconds,
               time_taken_seconds, completed_at`,
    [quizId, userId, score, total, JSON.stringify(answers),
     isExam, timeLimitSeconds, timeTakenSeconds]
  );
  return rows[0];
}

async function listAttempts(quizId, userId) {
  const { rows } = await pool.query(
    `SELECT id, score, total, is_exam, time_taken_seconds, completed_at
       FROM quiz_attempts
      WHERE quiz_id = $1 AND user_id = $2
      ORDER BY completed_at DESC`,
    [quizId, userId]
  );
  return rows;
}

module.exports = {
  create, addQuestions, findById, listByUser, setDescription, remove,
  saveAttempt, listAttempts,
};