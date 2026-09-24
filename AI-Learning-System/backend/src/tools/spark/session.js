// ============================================================
// tools/spark/session.js
// ------------------------------------------------------------
// Adaptive question selection for Spark.
//
// Responsibilities:
//   - Decide which skill to probe next (evidence gap analysis)
//   - Adjust difficulty based on recent performance
//   - Avoid repeating questions within a session
//   - Refill the bank via AI when seed variety is thin
//   - Decide when the assessment has enough evidence to end
//
// This file does NOT score or grade. Scoring lives in scoring.js.
// ============================================================

const db = require('../../db');
const logger = require('../../core/logger');

// ----------------------------------------------------------------
// Skill dimensions
// ----------------------------------------------------------------
const SKILLS = [
  'numerical_reasoning',
  'scientific_reasoning',
  'verbal_reasoning',
  'analytical_reasoning',
  'pattern_recognition',
  'creative_reasoning',
  'commercial_reasoning',
  'problem_solving',
  'communication',
  'decision_making',
  'practical_reasoning',
  'interest_alignment',
];

// Skills that every assessment must cover at least once.
const KEY_SKILLS = [
  'numerical_reasoning',
  'scientific_reasoning',
  'verbal_reasoning',
  'analytical_reasoning',
  'commercial_reasoning',
  'creative_reasoning',
  'interest_alignment',
];

// How much each skill contributes to each stream.
const STREAM_WEIGHTS = {
  science: {
    scientific_reasoning:  3.0,
    numerical_reasoning:   2.5,
    analytical_reasoning:  2.0,
    pattern_recognition:   1.5,
    problem_solving:       1.5,
    practical_reasoning:   1.0,
    interest_alignment:    1.0,
  },
  arts: {
    verbal_reasoning:      3.0,
    creative_reasoning:    2.5,
    communication:         2.5,
    analytical_reasoning:  1.5,
    interest_alignment:    1.5,
    problem_solving:       1.0,
  },
  commerce: {
    commercial_reasoning:  3.0,
    numerical_reasoning:   2.5,
    decision_making:       2.0,
    analytical_reasoning:  1.5,
    communication:         1.0,
    problem_solving:       1.0,
    interest_alignment:    1.0,
  },
};

// Difficulty ladder
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

// ----------------------------------------------------------------
// Session bounds
// ----------------------------------------------------------------
const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 12;
const MIN_EVIDENCE_PER_KEY_SKILL = 1;
const MIN_EVIDENCE_PER_ANY_SKILL = 2;

// How many seed questions must be available before we skip AI refill.
// If fewer than this exist for a skill+difficulty, we ask the AI to
// generate more.
const SEED_VARIETY_THRESHOLD = 3;

// ----------------------------------------------------------------
// Meta helpers
// ----------------------------------------------------------------

function getMeta(assessment) {
  const meta = assessment.meta || {};
  return {
    currentDifficulty: meta.currentDifficulty || 'medium',
    visitedQuestionIds: Array.isArray(meta.visitedQuestionIds) ? meta.visitedQuestionIds : [],
    skillDifficulty: meta.skillDifficulty || {},
    recentResults: Array.isArray(meta.recentResults) ? meta.recentResults : [],
    // recentResults entries: { skill, correct, difficulty }
    askedByCategory: meta.askedByCategory || {},
    numberAsked: meta.numberAsked || 0,
  };
}

async function saveMeta(assessmentId, meta) {
  await db.spark.updateAssessmentMeta(assessmentId, meta);
}

// ----------------------------------------------------------------
// Evidence analysis — what do we already know?
// ----------------------------------------------------------------

function evidenceBySkill(responses) {
  const map = {};
  for (const r of responses) {
    if (!r.skill) continue;
    if (!map[r.skill]) map[r.skill] = { count: 0, correct: 0, sumScore: 0 };
    map[r.skill].count += 1;
    if (r.correctness === true) map[r.skill].correct += 1;
    map[r.skill].sumScore += Number(r.score || 0);
  }
  return map;
}

function streamRelevance(skill) {
  // Average relevance across all three streams — used to weight probes
  let total = 0, n = 0;
  for (const stream of Object.keys(STREAM_WEIGHTS)) {
    const w = STREAM_WEIGHTS[stream][skill] || 0;
    total += w;
    if (w > 0) n += 1;
  }
  return n ? total / n : 0.1;
}

function needScore(skill, evidence) {
  const e = evidence[skill] || { count: 0 };
  const relevance = streamRelevance(skill);

  // Evidence gap: how far from the desired evidence count?
  const target = KEY_SKILLS.includes(skill)
    ? MIN_EVIDENCE_PER_KEY_SKILL
    : MIN_EVIDENCE_PER_ANY_SKILL;
  const gap = Math.max(0, target - e.count);

  // Never zero — always at least some baseline need to break ties
  return (gap + 0.25) * (relevance + 0.5);
}

// ----------------------------------------------------------------
// Difficulty adaptation
// ----------------------------------------------------------------

function nextDifficultyForSkill(meta, skill) {
  const recent = meta.recentResults.filter(r => r.skill === skill).slice(-2);
  if (!recent.length) return meta.skillDifficulty[skill] || 'medium';

  const correctCount = recent.filter(r => r.correct === true).length;
  const current = meta.skillDifficulty[skill] || 'medium';
  const idx = DIFFICULTY_ORDER.indexOf(current);

  if (correctCount === recent.length && recent.length >= 2) {
    return DIFFICULTY_ORDER[Math.min(idx + 1, DIFFICULTY_ORDER.length - 1)];
  }
  if (correctCount === 0 && recent.length >= 2) {
    return DIFFICULTY_ORDER[Math.max(idx - 1, 0)];
  }
  return current;
}

// ----------------------------------------------------------------
// Skill → (category, answerType) mapping for AI generation
// ----------------------------------------------------------------

/**
 * Map a skill to a sensible (category, answerType) for AI generation.
 * Most AI-generated questions are MCQ or numerical — the deterministic
 * kinds we can grade without another AI call.
 */
function pickCategoryAndType(skill) {
  const map = {
    numerical_reasoning:  { category: 'numerical',       answerType: 'mcq' },
    scientific_reasoning: { category: 'scientific',      answerType: 'mcq' },
    verbal_reasoning:     { category: 'verbal',          answerType: 'mcq' },
    analytical_reasoning: { category: 'analytical',      answerType: 'mcq' },
    pattern_recognition:  { category: 'pattern',         answerType: 'mcq' },
    commercial_reasoning: { category: 'commercial',      answerType: 'mcq' },
    creative_reasoning:   { category: 'creative',        answerType: 'open' },
    problem_solving:      { category: 'problem_solving', answerType: 'open' },
    communication:        { category: 'communication',   answerType: 'open' },
    decision_making:      { category: 'decision',        answerType: 'open' },
    practical_reasoning:  { category: 'practical',       answerType: 'mcq' },
    interest_alignment:   { category: 'interest',        answerType: 'mcq' },
  };
  return map[skill] || { category: 'knowledge', answerType: 'mcq' };
}

// ----------------------------------------------------------------
// Choice — pick the next question
// ----------------------------------------------------------------

/**
 * Choose the next question for this assessment.
 * Returns the question row, or null when the session is done.
 *
 * Strategy:
 *   1. If enough evidence is already gathered → end session.
 *   2. Rank skills by evidence need.
 *   3. For each skill in order, try difficulty ladder.
 *   4. If seed bank is thin (< SEED_VARIETY_THRESHOLD), call AI to refill.
 *   5. Fall back to whatever is available.
 */
async function chooseNextQuestion(assessment, responses) {
  const meta = getMeta(assessment);

  // ---------- Session done? ----------
  const totalAnswered = responses.length;
  const evidence = evidenceBySkill(responses);

  const allKeyCovered = KEY_SKILLS.every(skill => {
    const ev = evidence[skill];
    return ev && ev.count >= MIN_EVIDENCE_PER_KEY_SKILL;
  });

  if (totalAnswered >= MAX_QUESTIONS) {
    return null;
  }
  if (totalAnswered >= MIN_QUESTIONS && allKeyCovered) {
    const anyMissingKey = KEY_SKILLS.some(s => {
      const ev = evidence[s];
      return !ev || ev.count < 1;
    });
    if (!anyMissingKey) return null;
  }

  // ---------- Rank skills by need ----------
  const ranked = SKILLS
    .map(skill => ({ skill, need: needScore(skill, evidence) }))
    .sort((a, b) => b.need - a.need);

  // Lazy-load generator — only when we actually need it.
  let generator = null;
  try {
    generator = require('./generator');
  } catch (err) {
    logger.warn('[spark/session] generator not available: ' + err.message);
  }

  // ---------- Try each skill in order ----------
  for (const { skill } of ranked) {
    const difficulty = nextDifficultyForSkill(meta, skill);

    const difficultiesToTry = [difficulty, 'medium', 'easy', 'hard']
      .filter((d, i, arr) => arr.indexOf(d) === i);

    for (const d of difficultiesToTry) {
      const candidates = await db.spark.listActiveQuestions({
        skill,
        difficulty: d,
        excludeIds: meta.visitedQuestionIds,
      });

      // Plenty of seed variety — use it.
      if (candidates.length >= SEED_VARIETY_THRESHOLD) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        return picked;
      }

      // Thin on seed (1 or 2) — ask AI for more, then use a fresh one.
      if (generator && candidates.length >= 1 && candidates.length < SEED_VARIETY_THRESHOLD) {
        const { category, answerType } = pickCategoryAndType(skill);
        const fresh = await generator.refillBank({
          skill,
          difficulty: d,
          category,
          answerType,
          count: 2,
        });
        if (fresh.length) {
          // Prefer a fresh AI question to keep variety high.
          return fresh[Math.floor(Math.random() * fresh.length)];
        }
        // Generation failed — use whatever seed exists.
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        return picked;
      }

      // Exactly one candidate, no generator — use it.
      if (candidates.length === 1) {
        return candidates[0];
      }

      // Zero candidates — try the next difficulty.
    }

    // No seed at all for this skill — generate from scratch.
    if (generator) {
      const { category, answerType } = pickCategoryAndType(skill);
      const fresh = await generator.refillBank({
        skill,
        difficulty: 'medium',
        category,
        answerType,
        count: 2,
      });
      if (fresh.length) return fresh[0];
    }

    // Last resort: any seed question for this skill, ignoring difficulty.
    const anyForSkill = await db.spark.listActiveQuestions({
      skill,
      excludeIds: meta.visitedQuestionIds,
    });
    if (anyForSkill.length) {
      return anyForSkill[Math.floor(Math.random() * anyForSkill.length)];
    }
  }

  // Nothing left in the bank — end the session.
  logger.warn('[spark/session] no questions left for assessment ' + assessment.id);
  return null;
}

// ----------------------------------------------------------------
// Post-answer bookkeeping
// ----------------------------------------------------------------

async function recordAnswer(assessment, question, correctness) {
  const meta = getMeta(assessment);

  meta.visitedQuestionIds.push(question.id);
  meta.numberAsked += 1;
  meta.skillDifficulty[question.skill] = question.difficulty || 'medium';
  meta.recentResults.push({
    skill: question.skill,
    correct: correctness === true,
    difficulty: question.difficulty || 'medium',
  });
  // Keep only the last 6 results for adaptation
  if (meta.recentResults.length > 6) meta.recentResults = meta.recentResults.slice(-6);

  const catKey = question.category || 'other';
  meta.askedByCategory[catKey] = (meta.askedByCategory[catKey] || 0) + 1;

  await saveMeta(assessment.id, meta);
  return meta;
}

// ----------------------------------------------------------------
// Exports
// ----------------------------------------------------------------

module.exports = {
  SKILLS,
  KEY_SKILLS,
  STREAM_WEIGHTS,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  SEED_VARIETY_THRESHOLD,
  getMeta,
  saveMeta,
  evidenceBySkill,
  chooseNextQuestion,
  recordAnswer,
  pickCategoryAndType,
};