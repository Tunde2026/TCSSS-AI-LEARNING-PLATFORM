// ============================================================
// tools/spark/generator.js
// ------------------------------------------------------------
// Asks the AI to generate a single Spark question for a given
// (skill, difficulty) pair, then validates the result before
// it goes anywhere near the question bank.
//
// The AI generates content. It does NOT score anything.
// ============================================================

const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai/gateway');

// Allowed categories and answer types (must match the migration).
const ALLOWED_CATEGORIES = [
  'interest', 'numerical', 'scientific', 'verbal', 'analytical',
  'pattern', 'creative', 'commercial', 'scenario', 'knowledge', 'decision', 'practical',
];
const ALLOWED_ANSWER_TYPES = ['mcq', 'numerical', 'true_false', 'short_answer', 'open', 'ranking', 'scenario_choice'];
const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];

// Only MCQs and numerical are graded deterministically today.
// Others are used as evidence only — keep them rare.
const SAFE_GRADED_TYPES = ['mcq', 'numerical'];

/* ------------------------------------------------------------
   Prompt
   ------------------------------------------------------------ */
function buildPrompt({ skill, difficulty, category, answerType }) {
  return `You are generating ONE assessment question for "Spark", an adaptive
academic-direction assessment for Nigerian secondary school students (ages 13-18).

TARGET
- Skill being tested: ${skill}
- Difficulty: ${difficulty}
- Category: ${category}
- Answer type: ${answerType}

Return ONLY valid JSON. No prose, no markdown fences, no commentary.

If answer_type is "mcq":
{
  "question_text": "...",
  "options": [
    {"label": "A", "text": "..."},
    {"label": "B", "text": "..."},
    {"label": "C", "text": "..."},
    {"label": "D", "text": "..."}
  ],
  "correct_answer": "A",
  "explanation": "One sentence explaining the correct answer."
}

If answer_type is "numerical":
{
  "question_text": "...",
  "correct_answer": 42,
  "explanation": "One sentence."
}

If answer_type is "open" or "short_answer":
{
  "question_text": "...",
  "explanation": "What a strong answer would include."
}

RULES
- Use Nigerian context naturally (naira ₦, markets, farming, school life, local transport)
- Do not name real schools, teachers, or students
- Do not use sensitive attributes (religion, tribe, politics)
- Keep question_text under 220 characters
- For numerical: the answer must be unambiguous and computable in under 60 seconds
- For mcq: exactly 4 options, one clearly correct
- For ${difficulty} difficulty: ${difficultyGuidance(difficulty)}
- No trick questions, no "all of the above", no "none of the above"

Return the JSON now.`;
}

function difficultyGuidance(d) {
  if (d === 'easy')   return 'basic recall or single-step application';
  if (d === 'hard')   return 'multi-step reasoning or requires insight';
  return 'two-step reasoning appropriate for the skill';
}

/* ------------------------------------------------------------
   Parse + validate
   ------------------------------------------------------------ */
function parseJSON(raw) {
  let text = String(raw || '').trim();
  // Strip markdown fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Slice to the outermost {...}
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

function validate(generated, { answerType }) {
  if (!generated || typeof generated !== 'object') return 'not an object';
  if (typeof generated.question_text !== 'string' || generated.question_text.trim().length < 8) {
    return 'question_text missing or too short';
  }
  if (generated.question_text.length > 400) return 'question_text too long';

  if (answerType === 'mcq' || answerType === 'scenario_choice') {
    if (!Array.isArray(generated.options) || generated.options.length !== 4) {
      return 'mcq must have exactly 4 options';
    }
    for (const o of generated.options) {
      if (!o || typeof o.label !== 'string' || typeof o.text !== 'string') return 'malformed option';
      if (o.text.trim().length < 1) return 'empty option text';
    }
    const labels = generated.options.map(o => o.label);
    if (!labels.includes(generated.correct_answer)) return 'correct_answer does not match a label';
  }

  if (answerType === 'numerical') {
    if (typeof generated.correct_answer !== 'number' || !isFinite(generated.correct_answer)) {
      return 'numerical correct_answer must be a finite number';
    }
  }

  if (answerType === 'true_false') {
    if (![true, false].includes(generated.correct_answer)) return 'true_false correct_answer must be boolean';
  }

  return null;
}

/* ------------------------------------------------------------
   Duplicate check — first 60 characters of question_text
   ------------------------------------------------------------ */
async function isDuplicate(questionText) {
  const prefix = questionText.slice(0, 60).toLowerCase().trim();
  const res = await db.pool.query(
    `SELECT 1 FROM spark_question_bank
      WHERE LOWER(LEFT(question_text, 60)) = $1
      LIMIT 1`,
    [prefix]
  );
  return res.rowCount > 0;
}

/* ------------------------------------------------------------
   Generate one question
   ------------------------------------------------------------ */
async function generateOne({ skill, difficulty, category, answerType }) {
  if (!ALLOWED_CATEGORIES.includes(category)) return { ok: false, code: 'BAD_CATEGORY' };
  if (!ALLOWED_ANSWER_TYPES.includes(answerType)) return { ok: false, code: 'BAD_ANSWER_TYPE' };
  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) return { ok: false, code: 'BAD_DIFFICULTY' };

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: buildPrompt({ skill, difficulty, category, answerType }) },
        { role: 'user', content: 'Return the JSON only.' },
      ],
      temperature: 0.85,
      maxTokens: 512,
    });
  } catch (err) {
    logger.warn('[spark/generator] AI call failed: ' + err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_JSON' }; }

  const validationError = validate(parsed, { answerType });
  if (validationError) {
    logger.warn('[spark/generator] validation failed: ' + validationError);
    return { ok: false, code: 'VALIDATION_FAILED', detail: validationError };
  }

  if (await isDuplicate(parsed.question_text)) {
    return { ok: false, code: 'DUPLICATE' };
  }

  return {
    ok: true,
    question: {
      category,
      skill,
      difficulty,
      answerType,
      questionText: parsed.question_text.trim(),
      options: parsed.options || null,
      correctAnswer: parsed.correct_answer != null ? parsed.correct_answer : null,
      explanation: parsed.explanation || null,
    },
  };
}

/* ------------------------------------------------------------
   Generate N fresh questions and save them to the bank.
   Tries up to 3× per question before giving up.
   ------------------------------------------------------------ */
async function refillBank({ skill, difficulty, category, answerType, count = 2 }) {
  const saved = [];
  for (let i = 0; i < count; i++) {
    let got = null;
    for (let attempt = 0; attempt < 3 && !got; attempt++) {
      const r = await generateOne({ skill, difficulty, category, answerType });
      if (r.ok) got = r.question;
      else if (r.code === 'AI_FAILED') break; // don't hammer a dead provider
    }
    if (!got) continue;

    try {
      const row = await db.spark.createQuestion({
        category: got.category,
        skill: got.skill,
        difficulty: got.difficulty,
        answerType: got.answerType,
        questionText: got.questionText,
        options: got.options,
        correctAnswer: got.correctAnswer,
        explanation: got.explanation,
        targetStreams: [],
        createdBy: null,
      });
      // Mark as AI-generated
      await db.pool.query(
        'UPDATE spark_question_bank SET ai_generated = true WHERE id = $1',
        [row.id]
      );
      saved.push(row);
    } catch (err) {
      logger.warn('[spark/generator] save failed: ' + err.message);
    }
  }
  if (saved.length) {
    logger.info('[spark/generator] refilled ' + saved.length + ' ' + skill + '/' + difficulty + ' questions');
  }
  return saved;
}

module.exports = {
  generateOne,
  refillBank,
  ALLOWED_CATEGORIES,
  ALLOWED_ANSWER_TYPES,
  SAFE_GRADED_TYPES,
};