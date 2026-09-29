// ============================================================
// tools/sketch/service.js
// ------------------------------------------------------------
// Intelligent Sketch pipeline.
//
//   generateFormula  — unified entry point used by chat + lab
//   solveExpression  — explicit "solve this" (alias of the same)
//
// Both return the same shape so the frontend renders identically.
// ============================================================

const db     = require('../../db');
const logger = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildSketchPrompt, parseJSON, validate } = require('./solve');

/* ============================================================
   Saved sketches (unchanged behavior)
   ============================================================ */
async function save({ userId, title, subject, rawInput, renderedHtml, renderedText, kind }) {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    return { ok: false, code: 'EMPTY_INPUT' };
  }
  if (typeof renderedHtml !== 'string') {
    return { ok: false, code: 'MISSING_RENDERED_HTML' };
  }
  const sketch = await db.sketches.create({
    userId,
    title: (title || '').trim() || null,
    subject: (subject || '').trim() || null,
    rawInput: rawInput.trim(),
    renderedHtml,
    renderedText: renderedText || null,
    kind: kind || 'formula',
  });
  return { ok: true, sketch };
}

async function update({ userId, id, fields }) {
  const existing = await db.sketches.findById(id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (existing.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  const updated = await db.sketches.update(id, userId, fields || {});
  return updated ? { ok: true, sketch: updated } : { ok: false, code: 'UPDATE_FAILED' };
}

async function remove({ userId, id }) {
  const existing = await db.sketches.findById(id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (existing.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  const ok = await db.sketches.remove(id, userId);
  return ok ? { ok: true } : { ok: false, code: 'DELETE_FAILED' };
}

async function list({ userId }) {
  const list = await db.sketches.listForUser(userId);
  return { ok: true, sketches: list };
}

/* ============================================================
   AI call — unified
   ============================================================ */
async function callAI(query) {
  return chat({
    messages: [
      { role: 'system', content: buildSketchPrompt({ query: query }) },
      { role: 'user',   content: 'Return the JSON only.' },
    ],
    temperature: 0.2,
    maxTokens: 900,
  });
}

async function tryOnce(query) {
  const aiResult = await callAI(query);
  const parsed = parseJSON(aiResult.text);
  const vErr = validate(parsed);
  if (vErr) {
    const e = new Error('validation: ' + vErr);
    e.validationError = vErr;
    throw e;
  }
  return parsed;
}

/* ============================================================
   Unified entry point
   Returns the same shape for everything the frontend needs.
   ============================================================ */
async function generateFormula({ query, mode }) {
  if (!query || typeof query !== 'string' || query.trim().length < 1) {
    return { ok: false, code: 'INVALID_QUERY' };
  }
  if (query.length > 600) {
    return { ok: false, code: 'TOO_LONG' };
  }

  let parsed;

  // First attempt
  try {
    parsed = await tryOnce(query.trim());
  } catch (err) {
    logger.warn('[sketch] first attempt failed: ' + err.message);

    // Retry once with an extra strict instruction
    try {
      const strictQuery = query.trim() +
        '\n\n[STRICT: return ONLY valid JSON. No prose. No markdown. No trailing commas.]';
      parsed = await tryOnce(strictQuery);
    } catch (err2) {
      logger.warn('[sketch] second attempt failed: ' + err2.message);

      // Fail gracefully with a helpful fallback
      const plain = query.trim();
      return {
        ok: true,
        result: {
          kind: 'unknown',
          formatted_unicode: plain,
          formatted_latex: '',
          is_solvable: false,
          answer_plain: '',
          answer_latex: '',
          steps: [],
          notes: 'The AI could not parse that. Try rephrasing or check spelling.',
          explanation: '',
        },
      };
    }
  }

  // Normalize the shape for the frontend
  const result = {
    kind: parsed.kind || 'unknown',
    formatted_unicode: parsed.formatted_unicode || '',
    formatted_latex: parsed.formatted_latex || '',
    is_solvable: !!parsed.is_solvable,
    answer_plain: parsed.answer_plain || '',
    answer_latex: parsed.answer_latex || '',
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    notes: parsed.notes || '',
    explanation: parsed.explanation || '',

    // Backward-compat fields (old chat widget used these)
    plain: parsed.formatted_unicode || '',
    unicode: parsed.formatted_unicode || '',
    latex: parsed.formatted_latex || '',
    insertText: parsed.formatted_unicode || '',
  };

  return { ok: true, result };
}

/* Alias for callers who ask "solve this" explicitly */
async function solveExpression({ expression }) {
  if (!expression || typeof expression !== 'string') {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  return generateFormula({ query: expression, mode: 'solve' });
}

module.exports = {
  save,
  update,
  remove,
  list,
  generateFormula,
  solveExpression,
};
