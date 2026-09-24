// ============================================================
// db/queries/spark.js
// ------------------------------------------------------------
// Data access for Spark. Wraps all five spark_* tables.
//
// Conventions match db/queries/* elsewhere in the project:
//   - Shared pg Pool from ./pool
//   - Plain JS objects in/out
//   - DB errors bubble up to the caller
// ============================================================

const { pool } = require('../pool');

/* ============================================================
   QUESTION BANK
   ============================================================ */

async function createQuestion(input) {
  const {
    category, skill, difficulty = 'medium', answerType,
    questionText, options = null, correctAnswer = null,
    explanation = null, scoringConfig = null,
    targetStreams = [], ageMin = null, ageMax = null,
    createdBy = null,
  } = input;

  const result = await pool.query(
    `INSERT INTO spark_question_bank
       (category, skill, difficulty, answer_type, question_text,
        options, correct_answer, explanation, scoring_config,
        target_streams, age_min, age_max, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      category, skill, difficulty, answerType, questionText,
      options ? JSON.stringify(options) : null,
      correctAnswer != null ? JSON.stringify(correctAnswer) : null,
      explanation,
      scoringConfig ? JSON.stringify(scoringConfig) : null,
      targetStreams, ageMin, ageMax, createdBy,
    ]
  );
  return result.rows[0];
}

async function findQuestionById(id) {
  const result = await pool.query(
    'SELECT * FROM spark_question_bank WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

async function listActiveQuestions(filters = {}) {
  const clauses = ['active = true'];
  const params = [];

  if (filters.skill) {
    params.push(filters.skill);
    clauses.push('skill = $' + params.length);
  }
  if (filters.category) {
    params.push(filters.category);
    clauses.push('category = $' + params.length);
  }
  if (filters.difficulty) {
    params.push(filters.difficulty);
    clauses.push('difficulty = $' + params.length);
  }
  if (filters.excludeIds && filters.excludeIds.length) {
    params.push(filters.excludeIds);
    clauses.push('id <> ALL($' + params.length + ')');
  }

  const sql =
    'SELECT * FROM spark_question_bank ' +
    'WHERE ' + clauses.join(' AND ') + ' ' +
    'ORDER BY created_at DESC';

  const result = await pool.query(sql, params);
  return result.rows;
}

async function listAllQuestions() {
  const result = await pool.query(
    'SELECT * FROM spark_question_bank ORDER BY active DESC, created_at DESC'
  );
  return result.rows;
}

async function setQuestionActive(id, active) {
  const result = await pool.query(
    'UPDATE spark_question_bank SET active = $1 WHERE id = $2 RETURNING *',
    [!!active, id]
  );
  return result.rows[0] || null;
}

async function countActiveByCategory() {
  const result = await pool.query(
    `SELECT category, COUNT(*)::int AS count
       FROM spark_question_bank
      WHERE active = true
      GROUP BY category
      ORDER BY category`
  );
  return result.rows;
}

/* ============================================================
   ASSESSMENTS
   ============================================================ */

async function createAssessment(userId, version = 1) {
  const result = await pool.query(
    `INSERT INTO spark_assessments (user_id, status, version, meta)
     VALUES ($1, 'in_progress', $2, '{}'::jsonb)
     RETURNING *`,
    [userId, version]
  );
  return result.rows[0];
}

async function findAssessmentById(id) {
  const result = await pool.query(
    'SELECT * FROM spark_assessments WHERE id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

async function findActiveAssessmentForUser(userId) {
  const result = await pool.query(
    `SELECT * FROM spark_assessments
      WHERE user_id = $1 AND status = 'in_progress'
      ORDER BY started_at DESC
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function listAssessmentsForUser(userId, { limit = 20 } = {}) {
  const result = await pool.query(
    `SELECT id, status, version, started_at, completed_at
       FROM spark_assessments
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function updateAssessmentMeta(id, meta) {
  const result = await pool.query(
    `UPDATE spark_assessments SET meta = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(meta || {}), id]
  );
  return result.rows[0] || null;
}

async function completeAssessment(id, profile) {
  const result = await pool.query(
    `UPDATE spark_assessments
        SET status = 'completed',
            completed_at = now(),
            profile = $1
      WHERE id = $2
      RETURNING *`,
    [JSON.stringify(profile || {}), id]
  );
  return result.rows[0] || null;
}

async function abandonAssessment(id) {
  const result = await pool.query(
    `UPDATE spark_assessments SET status = 'abandoned' WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/* ============================================================
   RESPONSES
   ============================================================ */

async function saveResponse(input) {
  const {
    assessmentId, questionId, questionSnapshot, response,
    correctness = null, score = null, skill,
    responseTimeMs = null, aiAnalysis = null,
  } = input;

  const result = await pool.query(
    `INSERT INTO spark_responses
       (assessment_id, question_id, question_snapshot, response,
        correctness, score, skill, response_time_ms, ai_analysis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      assessmentId,
      questionId,
      JSON.stringify(questionSnapshot),
      JSON.stringify(response),
      correctness,
      score,
      skill,
      responseTimeMs,
      aiAnalysis ? JSON.stringify(aiAnalysis) : null,
    ]
  );
  return result.rows[0];
}

async function listResponsesForAssessment(assessmentId) {
  const result = await pool.query(
    `SELECT * FROM spark_responses
      WHERE assessment_id = $1
      ORDER BY created_at ASC`,
    [assessmentId]
  );
  return result.rows;
}

async function hasAnsweredQuestion(assessmentId, questionId) {
  const result = await pool.query(
    `SELECT 1 FROM spark_responses
      WHERE assessment_id = $1 AND question_id = $2
      LIMIT 1`,
    [assessmentId, questionId]
  );
  return result.rowCount > 0;
}

async function listAnsweredQuestionIds(assessmentId) {
  const result = await pool.query(
    `SELECT question_id FROM spark_responses
      WHERE assessment_id = $1 AND question_id IS NOT NULL`,
    [assessmentId]
  );
  return result.rows.map(r => r.question_id);
}

/* ============================================================
   SKILL SCORES
   ============================================================ */

async function upsertSkillScore(assessmentId, skill, score, confidence, evidenceCount, trend = null) {
  const result = await pool.query(
    `INSERT INTO spark_skill_scores
       (assessment_id, skill, score, confidence, evidence_count, trend, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (assessment_id, skill)
     DO UPDATE SET
       score = EXCLUDED.score,
       confidence = EXCLUDED.confidence,
       evidence_count = EXCLUDED.evidence_count,
       trend = EXCLUDED.trend,
       updated_at = now()
     RETURNING *`,
    [assessmentId, skill, score, confidence, evidenceCount, trend]
  );
  return result.rows[0];
}

async function listSkillScoresForAssessment(assessmentId) {
  const result = await pool.query(
    `SELECT * FROM spark_skill_scores
      WHERE assessment_id = $1
      ORDER BY score DESC`,
    [assessmentId]
  );
  return result.rows;
}

/* ============================================================
   RECOMMENDATIONS
   ============================================================ */

async function saveRecommendation(input) {
  const {
    assessmentId, stream, alignment, confidence,
    reasons = [], developmentAreas = [],
  } = input;

  const result = await pool.query(
    `INSERT INTO spark_recommendations
       (assessment_id, stream, alignment, confidence, reasons, development_areas)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (assessment_id, stream)
     DO UPDATE SET
       alignment = EXCLUDED.alignment,
       confidence = EXCLUDED.confidence,
       reasons = EXCLUDED.reasons,
       development_areas = EXCLUDED.development_areas
     RETURNING *`,
    [
      assessmentId, stream, alignment, confidence,
      JSON.stringify(reasons), JSON.stringify(developmentAreas),
    ]
  );
  return result.rows[0];
}

async function listRecommendationsForAssessment(assessmentId) {
  const result = await pool.query(
    `SELECT * FROM spark_recommendations
      WHERE assessment_id = $1
      ORDER BY
        CASE alignment
          WHEN 'strong'   THEN 1
          WHEN 'moderate' THEN 2
          WHEN 'limited'  THEN 3
          ELSE 4
        END,
        stream`,
    [assessmentId]
  );
  return result.rows;
}

/* ============================================================
   ADMIN
   ============================================================ */

async function adminStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM spark_question_bank WHERE active = true) AS active_questions,
      (SELECT COUNT(*)::int FROM spark_question_bank)                     AS total_questions,
      (SELECT COUNT(*)::int FROM spark_assessments)                       AS total_assessments,
      (SELECT COUNT(*)::int FROM spark_assessments WHERE status = 'completed') AS completed_assessments
  `);
  return result.rows[0];
}

/* ============================================================
   Exports
   ============================================================ */

module.exports = {
  createQuestion,
  findQuestionById,
  listActiveQuestions,
  listAllQuestions,
  setQuestionActive,
  countActiveByCategory,

  createAssessment,
  findAssessmentById,
  findActiveAssessmentForUser,
  listAssessmentsForUser,
  updateAssessmentMeta,
  completeAssessment,
  abandonAssessment,

  saveResponse,
  listResponsesForAssessment,
  hasAnsweredQuestion,
  listAnsweredQuestionIds,

  upsertSkillScore,
  listSkillScoresForAssessment,

  saveRecommendation,
  listRecommendationsForAssessment,

  adminStats,
};