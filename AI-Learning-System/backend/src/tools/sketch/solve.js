// ============================================================
// tools/sketch/solve.js
// ------------------------------------------------------------
// Shared JSON parser + validator for the Sketch pipeline.
// Also exposes a legacy buildSolvePrompt for backward compat.
// ============================================================

const { buildSketchPrompt } = require('./prompt');

/* ---------- Legacy entry point (still used by old callers) ---------- */
function buildSolvePrompt(expression) {
  return buildSketchPrompt({ query: expression });
}

/* ---------- Robust JSON extraction ---------- */
function parseJSON(raw) {
  let text = String(raw || '').trim();

  // Strip markdown fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Slice to outermost { ... }
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }

  // Fix common issues: trailing commas before closing braces/brackets
  text = text.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(text);
}

/* ---------- Validator ---------- */
const ALLOWED_KINDS = [
  'chemistry', 'physics',
  'math_expression', 'math_equation', 'calculus', 'matrix',
  'conversion', 'word_problem', 'unknown',
];

function validate(data) {
  if (!data || typeof data !== 'object') return 'not an object';

  // kind
  if (!data.kind || ALLOWED_KINDS.indexOf(data.kind) === -1) {
    data.kind = 'unknown';
  }

  // Normalize answer fields (accept old names too)
  if (!data.formatted_latex && data.latex) data.formatted_latex = data.latex;
  if (!data.formatted_unicode && data.unicode) data.formatted_unicode = data.unicode;
  if (!data.answer_plain && data.answer) data.answer_plain = data.answer;

  // formatted_latex must be a string
  if (typeof data.formatted_latex !== 'string') data.formatted_latex = '';
  if (typeof data.formatted_unicode !== 'string') data.formatted_unicode = '';

  // Wrap bare LaTeX in $...$
  if (data.formatted_latex && data.formatted_latex.indexOf('$') === -1) {
    data.formatted_latex = '$' + data.formatted_latex + '$';
  }
  if (data.answer_latex && data.answer_latex.indexOf('$') === -1) {
    data.answer_latex = '$' + data.answer_latex + '$';
  }

  // is_solvable default
  if (typeof data.is_solvable !== 'boolean') {
    data.is_solvable = !!(data.answer_plain || data.answer_latex);
  }

  // steps must be array of { text, latex? }
  if (!Array.isArray(data.steps)) data.steps = [];
  data.steps = data.steps
    .map(function (s) {
      if (typeof s === 'string') return { text: s, latex: '' };
      if (s && typeof s === 'object' && typeof s.text === 'string') {
        return { text: s.text, latex: typeof s.latex === 'string' ? s.latex : '' };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 8);

  // notes / explanation
  if (typeof data.notes !== 'string') data.notes = '';
  if (typeof data.explanation !== 'string') data.explanation = '';

  // Must have at least one representation
  if (!data.formatted_latex && !data.formatted_unicode) {
    return 'missing formatted representation';
  }

  return null;
}

module.exports = { buildSolvePrompt, buildSketchPrompt, parseJSON, validate, ALLOWED_KINDS };
