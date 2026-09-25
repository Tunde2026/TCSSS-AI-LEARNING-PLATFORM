// ============================================================
// tools/theory/prompt.js
// ------------------------------------------------------------
// AI prompt for generating fill-in-the-gap theory questions.
// ============================================================

function buildTheoryPrompt({ topic, count = 5, difficulty = 'medium', subject = null }) {
  return `You are generating fill-in-the-gap theory questions for secondary school students in Nigeria.

TOPIC: ${topic}
${subject ? 'SUBJECT: ' + subject : ''}
DIFFICULTY: ${difficulty}
NUMBER OF QUESTIONS: ${count}

WHAT YOU MUST PRODUCE

Each question is a single sentence or short paragraph with ONE blank.
The blank is written as three underscores: ___

The student types a short word or phrase to fill the blank.
The answer must be unambiguous and checkable by a simple text match.

Return ONLY valid JSON. No markdown, no prose outside the JSON.

SCHEMA:
{
  "title": "Short title for this set",
  "questions": [
    {
      "template": "The process by which plants make food using sunlight is called ___.",
      "accepted_answers": ["photosynthesis"],
      "hint": "It happens in the chloroplasts.",
      "explanation": "Plants use sunlight, water and carbon dioxide to make glucose."
    }
  ]
}

RULES

- Each template must contain exactly ONE ___ blank
- Answers must be SHORT — one word or a short phrase (max ~5 words)
- accepted_answers must be an array — include reasonable spelling variants
  Example for colour/color: ["colour", "color"]
  Example for plural: ["cell", "cells"]
- Do NOT use ambiguous questions where multiple different answers are correct
- Do NOT write questions with numbers that could be written multiple ways
  (avoid "how many" unless the answer is a simple digit)
- Use Nigerian curriculum context where helpful (WAEC / JSS / SSS style)
- Do NOT include the answer inside the hint
- Keep templates under 200 characters
- Difficulty guidance:
  easy   — basic recall of a key term
  medium — recall with slight reasoning, or completing a definition
  hard   — a more specific term or a two-step recall

Return the JSON now.`;
}

module.exports = { buildTheoryPrompt };