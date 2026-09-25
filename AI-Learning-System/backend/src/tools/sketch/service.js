// ============================================================
// tools/sketch/service.js
// ------------------------------------------------------------
// Sketch: saved formulas, symbol palette helpers,
// and AI formula generation.
// ============================================================

const db      = require('../../db');
const logger  = require('../../core/logger');
const { chat } = require('../../ai/gateway');
const { buildFormulaPrompt } = require('./prompt');

/* ------------------------------------------------------------
   Save a sketch
   ------------------------------------------------------------ */
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

/* ------------------------------------------------------------
   Update
   ------------------------------------------------------------ */
async function update({ userId, id, fields }) {
  const existing = await db.sketches.findById(id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (existing.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };

  const updated = await db.sketches.update(id, userId, fields || {});
  return updated ? { ok: true, sketch: updated } : { ok: false, code: 'UPDATE_FAILED' };
}

/* ------------------------------------------------------------
   Delete
   ------------------------------------------------------------ */
async function remove({ userId, id }) {
  const existing = await db.sketches.findById(id);
  if (!existing) return { ok: false, code: 'NOT_FOUND' };
  if (existing.user_id !== userId) return { ok: false, code: 'FORBIDDEN' };
  const ok = await db.sketches.remove(id, userId);
  return ok ? { ok: true } : { ok: false, code: 'DELETE_FAILED' };
}

/* ------------------------------------------------------------
   List
   ------------------------------------------------------------ */
async function list({ userId }) {
  const list = await db.sketches.listForUser(userId);
  return { ok: true, sketches: list };
}

/* ------------------------------------------------------------
   AI formula generation
   ------------------------------------------------------------ */
function parseJSON(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

async function generateFormula({ query }) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return { ok: false, code: 'INVALID_QUERY' };
  }

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: buildFormulaPrompt({ query: query.trim() }) },
        { role: 'user',   content: 'Return the JSON only.' },
      ],
      temperature: 0.3,
      maxTokens: 400,
    });
  } catch (err) {
    logger.warn('[sketch] AI call failed: ' + err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  // Pick the best representation to insert
  const insertText = parsed.unicode || parsed.plain || '';
  const latex = parsed.latex || '';

  return {
    ok: true,
    result: {
      kind: parsed.kind || 'auto',
      plain: parsed.plain || '',
      unicode: parsed.unicode || '',
      latex: latex,
      insertText: insertText,
      explanation: parsed.explanation || '',
    },
  };
}

/* ------------------------------------------------------------
   AI solve — format + solve a math expression
   ------------------------------------------------------------ */
async function solveExpression({ expression }) {
  if (!expression || typeof expression !== 'string' || expression.trim().length < 1) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (expression.length > 500) {
    return { ok: false, code: 'TOO_LONG' };
  }

  const { buildSolvePrompt, parseJSON, validate } = require('./solve');

  let aiResult;
  try {
    aiResult = await chat({
      messages: [
        { role: 'system', content: buildSolvePrompt(expression.trim()) },
        { role: 'user',   content: 'Return the JSON only.' },
      ],
      temperature: 0.2,
      maxTokens: 700,
    });
  } catch (err) {
    logger.warn('[sketch/solve] AI call failed: ' + err.message);
    return { ok: false, code: 'AI_FAILED' };
  }

  let parsed;
  try { parsed = parseJSON(aiResult.text); }
  catch (_) { return { ok: false, code: 'INVALID_AI_OUTPUT' }; }

  const err = validate(parsed);
  if (err) return { ok: false, code: 'VALIDATION_FAILED', detail: err };

  return {
    ok: true,
    result: {
      kind: parsed.kind || 'expression',
      latex: parsed.latex || '',
      plain: parsed.plain || expression,
      answer: parsed.answer || null,
      is_numeric: !!parsed.is_numeric,
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      explanation: parsed.explanation || '',
    },
  };
}

module.exports = {
  save,
  update,
  remove,
  list,
  generateFormula,
  solveExpression,   // ← new
};