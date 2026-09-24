// ============================================================
// tools/spark/service.js
// ------------------------------------------------------------
// Business logic for Spark. Routes call this. This calls
// session.js (question picking) and scoring.js (profile building).
// ============================================================

const db      = require('../../db');
const logger  = require('../../core/logger');
const session = require('./session');
const scoring = require('./scoring');

/* ------------------------------------------------------------
   Start or resume an assessment
   ------------------------------------------------------------ */
async function startAssessment(userId) {
  // If there's an in-progress assessment, resume it
  const existing = await db.spark.findActiveAssessmentForUser(userId);
  if (existing) {
    return getAssessmentState(existing.id, userId);
  }

  const assessment = await db.spark.createAssessment(userId);

  const question = await session.chooseNextQuestion(assessment, []);
  if (!question) {
    return {
      ok: false,
      code: 'NO_QUESTIONS',
      message: 'Spark question bank is empty. Please contact an administrator.',
    };
  }

  return {
    ok: true,
    assessment: {
      id: assessment.id,
      status: assessment.status,
      started_at: assessment.started_at,
    },
    question: sanitizeQuestion(question),
    progress: {
      answered: 0,
      min: session.MIN_QUESTIONS,
      max: session.MAX_QUESTIONS,
    },
  };
}

/* ------------------------------------------------------------
   Get current state (resume)
   ------------------------------------------------------------ */
async function getAssessmentState(assessmentId, userId) {
  const assessment = await db.spark.findAssessmentById(assessmentId);
  if (!assessment) return { ok: false, code: 'NOT_FOUND' };
  if (assessment.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };

  const responses = await db.spark.listResponsesForAssessment(assessmentId);

  if (assessment.status === 'completed') {
    return {
      ok: true,
      assessment: {
        id: assessment.id,
        status: 'completed',
        started_at: assessment.started_at,
        completed_at: assessment.completed_at,
      },
      completed: true,
    };
  }

  const question = await session.chooseNextQuestion(assessment, responses);

  if (!question) {
    return finishAssessment(assessment, responses);
  }

  return {
    ok: true,
    assessment: {
      id: assessment.id,
      status: assessment.status,
      started_at: assessment.started_at,
    },
    question: sanitizeQuestion(question),
    progress: {
      answered: responses.length,
      min: session.MIN_QUESTIONS,
      max: session.MAX_QUESTIONS,
    },
  };
}

/* ------------------------------------------------------------
   Submit a response
   ------------------------------------------------------------ */
async function submitResponse(assessmentId, userId, payload) {
  const assessment = await db.spark.findAssessmentById(assessmentId);
  if (!assessment) return { ok: false, code: 'NOT_FOUND' };
  if (assessment.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  if (assessment.status !== 'in_progress') {
    return { ok: false, code: 'ALREADY_COMPLETED' };
  }

  const { questionId, response, responseTimeMs } = payload || {};
  if (!questionId || response == null) {
    return { ok: false, code: 'INVALID_INPUT' };
  }

  const question = await db.spark.findQuestionById(questionId);
  if (!question) return { ok: false, code: 'QUESTION_NOT_FOUND' };

  const already = await db.spark.hasAnsweredQuestion(assessmentId, questionId);
  if (already) return { ok: false, code: 'ALREADY_ANSWERED' };

  const { correctness, score } = gradeResponse(question, response);

  await db.spark.saveResponse({
    assessmentId,
    questionId,
    questionSnapshot: question,
    response,
    correctness,
    score,
    skill: question.skill,
    responseTimeMs: responseTimeMs || null,
  });

  await session.recordAnswer(assessment, question, correctness);

  // Reload assessment (meta was updated) and responses
  const updated = await db.spark.findAssessmentById(assessmentId);
  const responses = await db.spark.listResponsesForAssessment(assessmentId);

  const nextQuestion = await session.chooseNextQuestion(updated, responses);
  if (!nextQuestion) {
    return finishAssessment(updated, responses);
  }

  return {
    ok: true,
    correct: correctness,
    score,
    nextQuestion: sanitizeQuestion(nextQuestion),
    progress: {
      answered: responses.length,
      min: session.MIN_QUESTIONS,
      max: session.MAX_QUESTIONS,
    },
  };
}

/* ------------------------------------------------------------
   Finish — compute profile, persist skill scores + recommendations
   ------------------------------------------------------------ */
async function finishAssessment(assessment, responses) {
  const profile = scoring.buildProfile(responses);

  for (const s of profile.skill_scores) {
    try {
      await db.spark.upsertSkillScore(
        assessment.id, s.skill, s.score, s.confidence, s.evidence_count, s.trend
      );
    } catch (err) {
      logger.warn('[spark] skill upsert failed: ' + err.message);
    }
  }

  for (const r of profile.recommendations) {
    try {
      await db.spark.saveRecommendation({
        assessmentId: assessment.id,
        stream: r.stream,
        alignment: r.alignment,
        confidence: r.confidence,
        reasons: r.reasons,
        developmentAreas: r.development_areas,
      });
    } catch (err) {
      logger.warn('[spark] recommendation save failed: ' + err.message);
    }
  }

  const completed = await db.spark.completeAssessment(assessment.id, profile);

  return {
    ok: true,
    completed: true,
    assessment: {
      id: assessment.id,
      status: 'completed',
      started_at: assessment.started_at,
      completed_at: completed ? completed.completed_at : new Date().toISOString(),
    },
    profile,
  };
}

/* ------------------------------------------------------------
   Get result
   ------------------------------------------------------------ */
async function getResult(assessmentId, userId) {
  const assessment = await db.spark.findAssessmentById(assessmentId);
  if (!assessment) return { ok: false, code: 'NOT_FOUND' };
  if (assessment.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  if (assessment.status !== 'completed') return { ok: false, code: 'NOT_COMPLETED' };

  const skillScores = await db.spark.listSkillScoresForAssessment(assessmentId);
  const recommendations = await db.spark.listRecommendationsForAssessment(assessmentId);

  return {
    ok: true,
    assessment: {
      id: assessment.id,
      started_at: assessment.started_at,
      completed_at: assessment.completed_at,
      version: assessment.version,
    },
    profile: assessment.profile || null,
    skill_scores: skillScores,
    recommendations,
  };
}

/* ------------------------------------------------------------
   History
   ------------------------------------------------------------ */
async function listHistory(userId) {
  const assessments = await db.spark.listAssessmentsForUser(userId, { limit: 30 });
  return { ok: true, assessments };
}

/* ------------------------------------------------------------
   Abandon
   ------------------------------------------------------------ */
async function abandonAssessment(assessmentId, userId) {
  const assessment = await db.spark.findAssessmentById(assessmentId);
  if (!assessment) return { ok: false, code: 'NOT_FOUND' };
  if (assessment.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  await db.spark.abandonAssessment(assessmentId);
  return { ok: true };
}

/* ------------------------------------------------------------
   Grade a single response
   ------------------------------------------------------------ */
function gradeResponse(question, response) {
  const type = question.answer_type;

  if (type === 'mcq' || type === 'scenario_choice' || type === 'true_false') {
    const correct = String(question.correct_answer);
    const selected = String(response);
    const isCorrect = correct === selected;
    return { correctness: isCorrect, score: isCorrect ? 1 : 0 };
  }

  if (type === 'numerical') {
    const expected = Number(question.correct_answer);
    const got = Number(response);
    if (isNaN(expected) || isNaN(got)) return { correctness: false, score: 0 };
    const isCorrect = Math.abs(expected - got) < 0.01;
    return { correctness: isCorrect, score: isCorrect ? 1 : 0 };
  }

  if (type === 'ranking') {
    const expected = Array.isArray(question.correct_answer) ? question.correct_answer : [];
    const got = Array.isArray(response) ? response : [];
    const isCorrect = expected.length === got.length && expected.every((v, i) => v === got[i]);
    if (isCorrect) return { correctness: true, score: 1 };
    // Partial credit for matching positions
    if (expected.length) {
      const matches = got.filter((v, i) => v === expected[i]).length;
      return { correctness: false, score: matches / expected.length };
    }
    return { correctness: false, score: 0 };
  }

  // short_answer / open — not graded deterministically yet.
  // Store as evidence with null score so it does not affect the skill average.
  return { correctness: null, score: null };
}

/* ------------------------------------------------------------
   Hide answer key from the client
   ------------------------------------------------------------ */
function sanitizeQuestion(q) {
  if (!q) return null;
  return {
    id: q.id,
    category: q.category,
    skill: q.skill,
    difficulty: q.difficulty,
    answer_type: q.answer_type,
    question_text: q.question_text,
    options: q.options,
    // No correct_answer, no explanation while assessment runs
  };
}

module.exports = {
  startAssessment,
  getAssessmentState,
  submitResponse,
  getResult,
  listHistory,
  abandonAssessment,
  gradeResponse,
  sanitizeQuestion,
};