// ============================================================
// tools/notes/prompt.js
// ------------------------------------------------------------
// AI prompts for transforming note content.
// Each action is a focused, single-purpose transformation.
// ============================================================

const ACTIONS = {
  summarize: {
    label: 'Summarize',
    system:
      'You are a study assistant. Summarize the student\'s note into a shorter version ' +
      'that keeps every important idea. Use bullet points if the note has multiple ideas. ' +
      'Keep the student\'s own wording where possible. Return Markdown only.',
  },
  rephrase: {
    label: 'Rephrase',
    system:
      'You are a study assistant. Rewrite the student\'s note in clearer language. ' +
      'Keep the same meaning and the same length. Return Markdown only.',
  },
  fix_typos: {
    label: 'Fix typos',
    system:
      'You are a proofreader. Fix spelling, grammar, and punctuation mistakes in the ' +
      'student\'s note. Do not change the meaning. Do not rewrite sentences that are ' +
      'already correct. Return the corrected text as Markdown only.',
  },
  simplify: {
    label: 'Simplify',
    system:
      'You are a study assistant for secondary school students. Rewrite the note using ' +
      'simpler words and shorter sentences. Preserve every fact. Return Markdown only.',
  },
  expand: {
    label: 'Expand',
    system:
      'You are a study assistant. Expand the student\'s note with additional relevant ' +
      'detail and one concrete example, but do not invent facts. Keep it focused. ' +
      'Return Markdown only.',
  },
  key_points: {
    label: 'Key points',
    system:
      'You are a study assistant. Extract the key points from the student\'s note as a ' +
      'short bullet list. Each bullet is one idea, under 20 words. Return Markdown only.',
  },
  outline: {
    label: 'Outline',
    system:
      'You are a study assistant. Turn the student\'s note into a structured outline ' +
      'using Markdown headings and nested bullets. Preserve all ideas. Return Markdown only.',
  },
};

const ALL_ACTIONS = Object.keys(ACTIONS);

function buildPrompt(action) {
  const a = ACTIONS[action];
  if (!a) return null;
  return {
    label: a.label,
    system:
      a.system +
      '\n\nReturn ONLY the transformed note text. Do not add commentary, ' +
      'preamble, or "Here is..." intros. Do not wrap the whole output in a code fence.',
  };
}

module.exports = { ACTIONS, ALL_ACTIONS, buildPrompt };