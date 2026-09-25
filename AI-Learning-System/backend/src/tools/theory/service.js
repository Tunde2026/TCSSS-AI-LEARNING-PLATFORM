// ============================================================
// tools/theory/service.js
// ------------------------------------------------------------
// Business logic for Theory. Called by routes.
// AI generates the questions; the app stores, scores, and
// validates everything.
// ============================================================

const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildTheoryPrompt } = require('./prompt');

const MAX_QUESTIONS_PER_SET = 30;
const MAX_DESCRIPTION_LENGTH = 500;

/* ------------------------------------------------------------
   JSON parsing (same pattern as quiz)
   ------------------------------------------------------------ */
function parseJSON(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return JSON.parse(text);
}

/* ------------------------------------------------------------
   Validation
   ------------------------------------------------------------ */
function validatePayload(data) {
  if (!data || typeof data !== 'object') return 'not an object';
  if (!Array.isArray(data.questions) || !data.questions.length) return 'no questions';
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    if (!q || typeof q.template !== 'string') return `question ${i+1} missing template`;
    if (q.template.indexOf('___') === -1) return `question ${i+1} has no ___ blank`;
    if (!Array.isArray(q.accepted_answers) || !q.accepted_answers.length) {
      return `question ${i+1} missing accepted_answers`;
    }
    for (const a of q.accepted_answers) {
      if (typeof a !== 'string' || !a.trim()) return `question ${i+1} has an empty answer`;
      if (a.length > 120) return `question ${i+1} answer is too long`;
    }
  }
  return null;
}

/* ------------------------------------------------------------
   Clean a user-provided description
   ------------------------------------------------------------ */
function cleanDescription(d) {
  if (d == null) return null;
  const s = String(d).trim();
  if (!s) return null;
  return s.slice(0, MAX_DESCRIPTION_LENGTH);
}

/* ------------------------------------------------------------
   Generate a new set via AI
   ------------------------------------------------------------ */
async function generate({
  userId,
  topic,
  count = 5,
  difficulty = 'medium',
  subject = null,
  description = null,
}) {
  if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
    return { ok: false, code: 'INVALID_TOPIC' };
  }
  const safeCount = Math.max(1, Math.min(MAX_QUESTIONS_PER_SET, Number(count) || 5));
  const safeDifficulty = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';
  const cleanTopic = topic.trim();

  const systemPrompt = buildTheoryPrompt({
    topic: cleanTopic,
    count: safeCount,
    difficulty: safeDifficulty,
    subject,
  });

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: 'Return the JSON now.' },
      ],
      temperature: 0.6,
      maxTokens: 2048,
    });
  } catch (err) {
    logger.error('[theory] AI call failed:', err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  const validationError = validatePayload(parsed);
  if (validationError) {
    return { ok: false, code: 'INVALID_AI_OUTPUT', detail: validationError };
  }

  const set = await db.theory.createSet({
    userId,
    title: parsed.title || `Theory on ${cleanTopic}`,
    subject: subject || null,
    topic: cleanTopic,
    difficulty: safeDifficulty,
    sourceType: 'ai',
    aiGenerated: true,
    description: cleanDescription(description),
  });

  const questions = parsed.questions.slice(0, safeCount).map(function (q, i) {
    return {
      position: i,
      template: q.template,
      accepted_answers: q.accepted_answers,
      hint: q.hint || null,
      explanation: q.explanation || null,
    };
  });

  await db.theory.addQuestions(set.id, questions);

  const full = await db.theory.findFullSet(set.id);
  return { ok: true, set: full };
}

/* ------------------------------------------------------------
   Manual creation (for students writing their own)
   ------------------------------------------------------------ */
async function createManual({
  userId,
  title,
  subject,
  topic,
  difficulty,
  questions,
  description = null,
}) {
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return { ok: false, code: 'INVALID_TITLE' };
  }
  if (!Array.isArray(questions) || !questions.length) {
    return { ok: false, code: 'NO_QUESTIONS' };
  }
  if (questions.length > MAX_QUESTIONS_PER_SET) {
    return { ok: false, code: 'TOO_MANY_QUESTIONS' };
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q.template !== 'string' || q.template.indexOf('___') === -1) {
      return { ok: false, code: 'INVALID_TEMPLATE', detail: `question ${i+1}` };
    }
    if (!Array.isArray(q.accepted_answers) || !q.accepted_answers.length) {
      return { ok: false, code: 'MISSING_ANSWERS', detail: `question ${i+1}` };
    }
  }

  const set = await db.theory.createSet({
    userId,
    title: title.trim(),
    subject: subject || null,
    topic: topic || null,
    difficulty: ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium',
    sourceType: 'manual',
    aiGenerated: false,
    description: cleanDescription(description),
  });

  await db.theory.addQuestions(set.id, questions.map(function (q, i) {
    return {
      position: i,
      template: q.template,
      accepted_answers: q.accepted_answers,
      hint: q.hint || null,
      explanation: q.explanation || null,
    };
  }));

  return { ok: true, set: await db.theory.findFullSet(set.id) };
}

/* ------------------------------------------------------------
   Normalization + matching for grading
   ------------------------------------------------------------ */
function normalize(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isCorrectMatch(userAnswer, accepted) {
  if (!Array.isArray(accepted)) return false;
  const user = normalize(userAnswer);
  if (!user) return false;
  return accepted.some(function (a) { return normalize(a) === user; });
}

/* ------------------------------------------------------------
   Grade a submission
   ------------------------------------------------------------ */
async function gradeAttempt({ setId, userId, answers, timeTakenSeconds = null }) {
  const set = await db.theory.findFullSet(setId);
  if (!set) return { ok: false, code: 'NOT_FOUND' };
  if (set.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  if (!Array.isArray(answers)) return { ok: false, code: 'INVALID_ANSWERS' };

  const graded = [];
  let score = 0;

  for (const q of set.questions) {
    const submitted = answers.find(function (a) { return a.questionId === q.id; });
    const userAnswer = submitted ? String(submitted.answer || '') : '';
    const accepted = Array.isArray(q.accepted_answers) ? q.accepted_answers : [];
    const correct = isCorrectMatch(userAnswer, accepted);
    if (correct) score += 1;

    graded.push({
      questionId: q.id,
      template: q.template,
      userAnswer: userAnswer,
      correct: correct,
      acceptedAnswers: accepted,
      hint: q.hint || null,
      explanation: q.explanation || null,
    });
  }

  const attempt = await db.theory.saveAttempt({
    setId,
    userId,
    score,
    total: set.questions.length,
    answers: graded,
    timeTakenSeconds: timeTakenSeconds != null ? Number(timeTakenSeconds) : null,
  });

  return {
    ok: true,
    attempt: {
      id: attempt.id,
      score: attempt.score,
      total: attempt.total,
      completed_at: attempt.completed_at,
    },
    graded: graded,
  };
}

/* ------------------------------------------------------------
   Update description
   ------------------------------------------------------------ */
async function setDescription({ setId, userId, description }) {
  const set = await db.theory.findSetById(setId);
  if (!set) return { ok: false, code: 'NOT_FOUND' };
  if (set.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  const updated = await db.theory.setDescription(
    setId, userId, cleanDescription(description)
  );
  return updated ? { ok: true, set: updated } : { ok: false, code: 'UPDATE_FAILED' };
}

/* ------------------------------------------------------------
   Delete
   ------------------------------------------------------------ */
async function removeSet({ setId, userId }) {
  const set = await db.theory.findSetById(setId);
  if (!set) return { ok: false, code: 'NOT_FOUND' };
  if (set.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  await db.theory.removeSet(setId, userId);
  return { ok: true };
}

module.exports = {
  generate,
  createManual,
  gradeAttempt,
  setDescription,
  removeSet,
  isCorrectMatch,
  normalize,
};