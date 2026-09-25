// ============================================================
// tools/sketch/solve.js
// ------------------------------------------------------------
// AI-powered math expression formatter + solver for Sketch.
// The AI returns: formatted LaTeX, the answer, working steps,
// and a short explanation.
// ============================================================

function buildSolvePrompt(expression) {
  return `You are a math and science tutor assistant for Nigerian secondary school students.

The student wrote this in a formula editor:
"""
${expression}
"""

Your job:
1. Interpret what they meant (fix obvious notation issues like missing parentheses).
2. Return a clean LaTeX representation.
3. If it is a computable expression, compute the answer.
4. If it is an equation with a variable, solve for the variable.
5. Provide brief step-by-step reasoning.
6. Give a short explanation in simple English.

Return ONLY valid JSON with this exact shape:

{
  "kind": "expression" | "equation" | "formula" | "chemistry" | "physics",
  "latex": "$\\\\frac{8}{9}^{\\\\frac{1}{2}}$",
  "plain": "(8/9)^(1/2)",
  "answer": "≈ 0.943",
  "is_numeric": true,
  "steps": [
    "Step one...",
    "Step two..."
  ],
  "explanation": "One short sentence in simple English."
}

RULES:
- The "latex" field must be valid LaTeX wrapped in single $...$ for inline
- Use \\\\frac{numerator}{denominator} for fractions
- Use ^{...} for superscripts and _{...} for subscripts
- Use \\\\sqrt{} for roots, \\\\pi for pi, \\\\theta for theta, etc.
- If the input is not mathematical (e.g. random text), set kind to "formula" and leave answer blank
- If you cannot solve it, say so in "explanation" but still return valid JSON
- Do NOT invent an answer — say "Not enough information" if the problem is incomplete
- Keep steps under 6 items
- Keep explanation under 200 characters

Return JSON only. No prose outside. No markdown fences.`;
}

function parseJSON(raw) {
  let text = String(raw || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

function validate(data) {
  if (!data || typeof data !== 'object') return 'not an object';
  if (typeof data.latex !== 'string') return 'missing latex';
  return null;
}

module.exports = { buildSolvePrompt, parseJSON, validate };