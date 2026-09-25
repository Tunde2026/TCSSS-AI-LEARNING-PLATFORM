// ============================================================
// tools/sketch/prompt.js
// ------------------------------------------------------------
// AI prompt for generating a formula / scientific notation
// for a named chemical, math, or physics expression.
// ============================================================

function buildFormulaPrompt({ query, kind = 'auto' }) {
  return `You are a formula and scientific notation assistant for secondary school students in Nigeria.

The student has asked for: "${query}"

Determine what kind of notation is needed:
- "chemistry" for chemical formulas, ions, reactions
- "physics" for physics formulas
- "math" for mathematical expressions
- "auto" if unclear — infer from the query

Return ONLY valid JSON with this exact shape:

{
  "kind": "chemistry" | "physics" | "math",
  "plain": "plain text version, e.g. H2SO4",
  "unicode": "Unicode version with subscripts/superscripts, e.g. H₂SO₄",
  "latex": "LaTeX version inside $...$, e.g. $\\\\text{H}_2\\\\text{SO}_4$",
  "explanation": "One short sentence explaining the notation."
}

RULES:
- For chemistry: use \\\\text{} in LaTeX to keep element names upright
- Subscripts use Unicode ₀-₉ or LaTeX _{...}
- Superscripts use Unicode ⁰-⁹ or LaTeX ^{...}
- Greek letters as Unicode (α, β, θ) or LaTeX (\\\\alpha, \\\\beta, \\\\theta)
- Fractions use Unicode (½) or LaTeX (\\\\frac{}{})
- Root: √x or \\\\sqrt{x}
- Do NOT invent a formula if you are not sure. If unsure, return:
  { "kind": "auto", "plain": "", "unicode": "", "latex": "", "explanation": "I am not sure what formula you mean. Please describe the compound or equation." }

Return JSON only — no prose, no markdown fences.`;
}

module.exports = { buildFormulaPrompt };// ============================================================
// tools/sketch/prompt.js
// ------------------------------------------------------------
// AI prompt for generating a formula / scientific notation
// for a named chemical, math, or physics expression.
// ============================================================

function buildFormulaPrompt({ query, kind = 'auto' }) {
  return `You are a formula and scientific notation assistant for secondary school students in Nigeria.

The student has asked for: "${query}"

Determine what kind of notation is needed:
- "chemistry" for chemical formulas, ions, reactions
- "physics" for physics formulas
- "math" for mathematical expressions
- "auto" if unclear — infer from the query

Return ONLY valid JSON with this exact shape:

{
  "kind": "chemistry" | "physics" | "math",
  "plain": "plain text version, e.g. H2SO4",
  "unicode": "Unicode version with subscripts/superscripts, e.g. H₂SO₄",
  "latex": "LaTeX version inside $...$, e.g. $\\\\text{H}_2\\\\text{SO}_4$",
  "explanation": "One short sentence explaining the notation."
}

RULES:
- For chemistry: use \\\\text{} in LaTeX to keep element names upright
- Subscripts use Unicode ₀-₉ or LaTeX _{...}
- Superscripts use Unicode ⁰-⁹ or LaTeX ^{...}
- Greek letters as Unicode (α, β, θ) or LaTeX (\\\\alpha, \\\\beta, \\\\theta)
- Fractions use Unicode (½) or LaTeX (\\\\frac{}{})
- Root: √x or \\\\sqrt{x}
- Do NOT invent a formula if you are not sure. If unsure, return:
  { "kind": "auto", "plain": "", "unicode": "", "latex": "", "explanation": "I am not sure what formula you mean. Please describe the compound or equation." }

Return JSON only — no prose, no markdown fences.`;
}

module.exports = { buildFormulaPrompt };