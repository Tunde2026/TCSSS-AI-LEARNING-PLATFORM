const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildQuizPrompt } = require('./prompt');

function parseQuizJSON(raw) {
  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace  = text.lastIndexOf('}');
  if (firstBrace > 0 || lastBrace !== text.length - 1) {
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(text);
}

function validateQuiz(data) {
  if (!data || typeof data !== 'object') return 'Response is not an object';
  if (!Array.isArray(data.questions) || data.questions.length === 0) return 'Response has no questions';
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q.question || typeof q.question !== 'string') return `Question ${i+1} missing text`;
    if (!Array.isArray(q.options) || q.options.length !== 4) return `Question ${i+1} must have 4 options`;
    for (const opt of q.options) {
      if (!opt.label || !opt.text) return `Question ${i+1} has a malformed option`;
    }
    if (!['A','B','C','D'].includes(q.correct)) return `Question ${i+1} has invalid correct answer`;
  }
  return null;
}

async function generate({ userId, topic, count = 5, difficulty = 'medium',
                           subject = null, isExam = false, timeLimitSeconds = null }) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }
  const safeCount = Math.max(1, Math.min(20, Number(count) || 5));
  const safeDifficulty = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';

  const systemPrompt = buildQuizPrompt({
    topic: topic.trim(),
    count: safeCount,
    difficulty: safeDifficulty,
    subject,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate the quiz now. Return only the JSON.` },
      ],
      temperature: 0.5,
      maxTokens: 2048,
    });
  } catch (err) {
    logger.error('[quiz] AI call failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseQuizJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  const validationError = validateQuiz(parsed);
  if (validationError) return { ok: false, code: 'INVALID_AI_OUTPUT', detail: validationError };

  const quiz = await db.quizzes.create({
    userId,
    title: parsed.title || `Quiz on ${topic}`,
    subject: subject || null,
    topic: topic.trim(),
    difficulty: safeDifficulty,
    isExam: !!isExam,
    timeLimitSeconds: isExam ? (Number(timeLimitSeconds) || 600) : null,
  });

  const questions = parsed.questions.slice(0, safeCount).map(q => ({
    question: q.question,
    options:  q.options,
    correct:  q.correct,
    explanation: q.explanation || null,
  }));

  await db.quizzes.addQuestions(quiz.id, questions);
  const full = await db.quizzes.findById(quiz.id);
  return { ok: true, quiz: full };
}

async function gradeAttempt({ quizId, userId, answers, timeTakenSeconds = null }) {
  const quiz = await db.quizzes.findById(quizId);
  if (!quiz) return { ok: false, code: 'NOT_FOUND' };
  if (quiz.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  if (!Array.isArray(answers)) return { ok: false, code: 'INVALID_ANSWERS' };

  let score = 0;
  const graded = [];

  for (const q of quiz.questions) {
    const submitted = answers.find(a => a.questionId === q.id);
    const selected  = submitted ? submitted.selected : null;
    const correct   = q.correct_option;
    const isCorrect = selected === correct;
    if (isCorrect) score += 1;

    graded.push({ questionId: q.id, selected, correct, isCorrect });
  }

  const attempt = await db.quizzes.saveAttempt({
    quizId,
    userId,
    score,
    total: quiz.questions.length,
    answers: graded,
    isExam: quiz.is_exam || false,
    timeLimitSeconds: quiz.time_limit_seconds || null,
    timeTakenSeconds: timeTakenSeconds != null ? Number(timeTakenSeconds) : null,
  });

  return {
    ok: true,
    attempt: {
      id: attempt.id,
      score: attempt.score,
      total: attempt.total,
      is_exam: attempt.is_exam,
      time_taken_seconds: attempt.time_taken_seconds,
      completed_at: attempt.completed_at,
    },
    graded,
    questions: quiz.questions,
  };
}

module.exports = { generate, gradeAttempt };